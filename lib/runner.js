var flow = require('..').promise.controlFlow();


/**
 * Wraps a function so that all passed arguments are ignored.
 * @param {!Function} fn The function to wrap.
 * @return {!Function} The wrapped function.
 */
function seal(fn) {
    return function () {
        fn();
    };
}


/**
 * Wraps a function on Mocha's BDD interface so it runs inside a
 * webdriver.promise.ControlFlow and waits for the flow to complete before
 * continuing.
 * @param {!Function} globalFn The function to wrap.
 * @return {!Function} The new function.
 */
function wrapped(globalFn) {
    return function () {
        switch (arguments.length) {
            case 1:
                globalFn(asyncTestFn(arguments[0]));
                break;

            case 2:
                globalFn(arguments[0], asyncTestFn(arguments[1]));
                break;

            default:
                throw Error('Invalid # arguments: ' + arguments.length);
        }
    };

    function asyncTestFn(fn) {
        return function (done) {
            this.timeout(0);
            flow.execute(fn).then(seal(done), done);
        };
    }
}


/**
 * Ignores the test chained to this function if the provided predicate returns
 * true.
 * @param {function(): boolean} predicateFn A predicate to call to determine
 *     if the test should be suppressed. This function MUST be synchronous.
 * @return {!Object} An object with wrapped versions of {@link #it()} and
 *     {@link #describe()} that ignore tests as indicated by the predicate.
 */
function ignore(predicateFn) {
    var describe = wrap(exports.xdescribe, exports.describe);
    describe.only = wrap(exports.xdescribe, exports.describe.only);

    var it = wrap(exports.xit, exports.it);
    it.only = wrap(exports.xit, exports.it.only);

    return {
        describe: describe,
        it: it
    };

    function wrap(onSkip, onRun) {
        return function (title, fn) {
            if (predicateFn()) {
                onSkip(title, fn);
            } else {
                onRun(title, fn);
            }
        };
    }
}


// PUBLIC API

/**
 * Registers a new test suite.
 * @param {string} name The suite name.
 * @param {function()=} fn The suite function, or {@code undefined} to define
 *     a pending test suite.
 */
exports.describe = global.describe;

/**
 * Defines a suppressed test suite.
 * @param {string} name The suite name.
 * @param {function()=} fn The suite function, or {@code undefined} to define
 *     a pending test suite.
 */
exports.xdescribe = global.xdescribe;
exports.describe.skip = global.describe.skip;

/**
 * Register a function to call after the current suite finishes.
 * @param {function()} fn .
 */
exports.after = wrapped(global.after);

/**
 * Register a function to call after each test in a suite.
 * @param {function()} fn .
 */
exports.afterEach = wrapped(global.afterEach);

/**
 * Register a function to call before the current suite starts.
 * @param {function()} fn .
 */
exports.before = wrapped(global.before);

/**
 * Register a function to call before each test in a suite.
 * @param {function()} fn .
 */
exports.beforeEach = wrapped(global.beforeEach);

/**
 * Add a test to the current suite.
 * @param {string} name The test name.
 * @param {function()=} fn The test function, or {@code undefined} to define
 *     a pending test case.
 */
exports.it = wrapped(global.it);

/**
 * An alias for {@link #it()} that flags the test as the only one that should
 * be run within the current suite.
 * @param {string} name The test name.
 * @param {function()=} fn The test function, or {@code undefined} to define
 *     a pending test case.
 */
exports.iit = exports.it.only = wrapped(global.it.only);

/**
 * Adds a test to the current suite while suppressing it so it is not run.
 * @param {string} name The test name.
 * @param {function()=} fn The test function, or {@code undefined} to define
 *     a pending test case.
 */
exports.xit = exports.it.skip = wrapped(global.xit);

exports.ignore = ignore;
