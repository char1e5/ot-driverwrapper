/**
 * Wraps webdriver to provide more function to use.
 * @param {!Function} fn The function to wrap.
 * @return {!Function} The wrapped function.
 */
var url = require('url');
var path = require('path');
var webdriver = require('selenium-webdriver');
var remote = require('selenium-webdriver/remote');

var DEFER_LABEL = 'APP_DEFER_BOOTSTRAP!';

var WEB_ELEMENT_FUNCTIONS = [
    'click', 'sendKeys', 'getTagName', 'getCssValue', 'getAttribute', 'getText',
    'getSize', 'getLocation', 'isEnabled', 'isSelected', 'submit', 'clear',
    'isDisplayed', 'getOuterHtml', 'getInnerHtml'];


/**
 * Mix in other webdriver functionality to be accessible via driverwrapper.
 */
for (foo in webdriver) {
    exports[foo] = webdriver[foo];
}

/**
 * Mix a function from one object onto another. The function will still be
 * called in the context of the original object.
 *
 * @private
 * @param {Object} to
 * @param {Object} from
 * @param {string} fnName
 */
var mixin = function (to, from, fnName) {
    to[fnName] = function () {
        return from[fnName].apply(from, arguments);
    };
};

/**
 * Build the helper 'element' function for a given instance of DriverWrapper.
 *
 * @private
 * @param {DriverWrapper} wrapper
 * @param {=Array.<webdriver.Locator>} opt_usingChain
 * @return {function(webdriver.Locator): ElementFinder}
 */
var buildElementHelper = function (wrapper, opt_usingChain) {
    var usingChain = opt_usingChain || [];
    var using = function () {
        var base = wrapper;
        for (var i = 0; i < usingChain.length; ++i) {
            base = base.findElement(usingChain[i]);
        }
        return base;
    };

    /**
     * The element function returns an Element Finder. Element Finders do
     * not actually attempt to find the element until a method is called on them,
     * which means they can be set up in helper files before the page is
     * available.
     *
     * Example:
     *     var nameInput = element(by.model('name'));
     *     browser.get('myurl');
     *     nameInput.sendKeys('Jane Doe');
     *
     * @param {webdriver.Locator} locator
     * @return {ElementFinder}
     */
    var element = function (locator) {
        var elementFinder = {};

        // var webElementFns = WEB_ELEMENT_FUNCTIONS.concat(
        //     ['findElements', 'isElementPresent', 'evaluate', '$$']);
        var webElementFns = WEB_ELEMENT_FUNCTIONS.concat(
            ['findElements', 'isElementPresent', '$$']);
        webElementFns.forEach(function (fnName) {
            elementFinder[fnName] = function () {
                var args = arguments;

                return using().findElement(locator).then(function (element) {
                    return element[fnName].apply(element, args);
                }, function (error) {
                    throw error;
                });
            };
        });

        // This is a special case since it doesn't return a promise, instead it
        // returns a WebElement.
        elementFinder.findElement = function (subLocator) {
            return using().findElement(locator).findElement(subLocator);
        };

        /**
         * Return the actual WebElement.
         *
         * @return {webdriver.WebElement}
         */
        elementFinder.find = function () {
            return using().findElement(locator);
        };

        /**
         * @return {boolean} whether the element is present on the page.
         */
        elementFinder.isPresent = function () {
            return using().isElementPresent(locator);
        };

        /**
         * Calls to element may be chained to find elements within a parent.
         * Example:
         *     var name = element(by.id('container')).element(by.model('name'));
         *     browser.get('myurl');
         *     name.sendKeys('John Smith');
         *
         * @param {DriverWrapper} wrapper
         * @param {=Array.<webdriver.Locator>} opt_usingChain
         * @return {function(webdriver.Locator): ElementFinder}
         */
        elementFinder.element =
            buildElementHelper(wrapper, usingChain.concat(locator));

        /**
         * Shortcut for chaining css element finders.
         * Example:
         *     var name = element(by.id('container')).$('input.myclass');
         *     browser.get('myurl');
         *     name.sendKeys('John Smith');
         *
         * @param {string} cssSelector
         * @return {ElementFinder}
         */
        elementFinder.$ = function (cssSelector) {
            return buildElementHelper(wrapper, usingChain.concat(locator))(
                webdriver.By.css(cssSelector));
        };

        return elementFinder;
    };

    /**
     * element.all is used for operations on an array of elements (as opposed
     * to a single element).
     *
     * Example:
     *     var lis = element.all(by.css('li'));
     *     browser.get('myurl');
     *     expect(lis.count()).toEqual(4);
     *
     * @param {webdriver.Locator} locator
     * @return {ElementArrayFinder}
     */
    element.all = function (locator) {
        var elementArrayFinder = {};

        /**
         * @return {number} the number of elements matching the locator.
         */
        elementArrayFinder.count = function () {
            return using().findElements(locator).then(function (arr) {
                return arr.length;
            });
        };

        /**
         * @param {number} index
         * @return {webdriver.WebElement} the element at the given index
         */
        elementArrayFinder.get = function (index) {
            var id = using().findElements(locator).then(function (arr) {
                return arr[index];
            });
            return wrapper.wrapWebElement(new webdriver.WebElement(wrapper.driver, id));
        };

        /**
         * @return {webdriver.WebElement} the first matching element
         */
        elementArrayFinder.first = function () {
            var id = using().findElements(locator).then(function (arr) {
                if (!arr.length) {
                    throw new Error('No element found using locator: ' + locator.message);
                }
                return arr[0];
            });
            return wrapper.wrapWebElement(new webdriver.WebElement(wrapper.driver, id));
        };

        /**
         * @return {webdriver.WebElement} the last matching element
         */
        elementArrayFinder.last = function () {
            var id = using().findElements(locator).then(function (arr) {
                return arr[arr.length - 1];
            });
            return wrapper.wrapWebElement(new webdriver.WebElement(wrapper.driver, id));
        };

        /**
         * @type {webdriver.promise.Promise} a promise which will resolve to
         *     an array of WebElements matching the locator.
         */
        elementArrayFinder.then = function (fn) {
            return using().findElements(locator).then(fn);
        };

        /**
         * Calls the input function on each WebElement found by the locator.
         *
         * @param {function(webdriver.WebElement)}
         */
        elementArrayFinder.each = function (fn) {
            using().findElements(locator).then(function (arr) {
                arr.forEach(function (webElem) {
                    fn(webElem);
                });
            });
        };

        /**
         * Apply a map function to each element found using the locator. The
         * callback receives the web element as the first argument and the index as
         * a second arg.
         *
         * Usage:
         *   <ul class="menu">
         *     <li class="one">1</li>
         *     <li class="two">2</li>
         *   </ul>
         *
         *   var items = element.all(by.css('.menu li')).map(function(elm, index) {
     *     return {
     *       index: index,
     *       text: elm.getText(),
     *       class: elm.getAttribute('class')
     *     };
     *   });
         *   expect(items).toEqual([
         *     {index: 0, text: '1', class: 'one'},
         *     {index: 0, text: '1', class: 'one'},
         *   ]);
         *
         * @param {function(webdriver.WebElement, number)} mapFn Map function that
         *     will be applied to each element.
         * @return {!webdriver.promise.Promise} A promise that resolves to an array
         *     of values returned by the map function.
         */
        elementArrayFinder.map = function (mapFn) {
            return using().findElements(locator).then(function (arr) {
                var list = [];
                arr.forEach(function (webElem, index) {
                    var mapResult = mapFn(webElem, index);
                    // All nested arrays and objects will also be fully resolved.
                    webdriver.promise.fullyResolved(mapResult).then(function (resolved) {
                        list.push(resolved);
                    });
                });
                return list;
            });
        };

        return elementArrayFinder;
    };

    return element;
};

/**
 * Build the helper 'id' function for a given instance of DriverWrapper.
 *
 * @private
 * @param {DriverWrapper} wrapper
 * @return {function(string): ElementFinder}
 */
var buildIdHelper = function (wrapper) {
    return function (idSelector) {
        var el = buildElementHelper(wrapper)(webdriver.By.id(idSelector));
        return waitForDisplayed(wrapper, el, opt_timeout);
    };
};

/**
 * Build the helper 'id' function for a given instance of DriverWrapper.
 *
 * @private
 * @param {DriverWrapper} wrapper
 * @return {function(string): ElementFinder}
 */
var buildIdHelperWithoutWait = function (wrapper) {
    return function (idSelector) {
        return buildElementHelper(wrapper)(webdriver.By.id(idSelector));
    };
};

/**
 * Build the helper '$' function for a given instance of DriverWrapper.
 *
 * @private
 * @param {DriverWrapper} wrapper
 * @return {function(string): ElementFinder}
 */
var buildCssHelper = function (wrapper, opt_timeout) {
    return function (cssSelector) {
        var el = buildElementHelper(wrapper)(webdriver.By.css(cssSelector));
        return waitForDisplayed(wrapper, el, opt_timeout);
    };
};

/**
 * Build the helper '$' function for a given instance of DriverWrapper.
 *
 * @private
 * @param {DriverWrapper} wrapper
 * @return {function(string): ElementFinder}
 */
var buildCssHelperWithoutWait = function (wrapper) {
    return function (cssSelector) {
        return buildElementHelper(wrapper)(webdriver.By.css(cssSelector));
    };
};

/**
 * Build the helper '$$' function for a given instance of DriverWrapper.
 *
 * @private
 * @param {DriverWrapper} wrapper
 * @return {function(string): ElementArrayFinder}
 */
var buildMultiCssHelper = function (wrapper) {
    return function (cssSelector) {
        return buildElementHelper(wrapper).all(webdriver.By.css(cssSelector));
    };
};


var waitForDisplayed = function (wrapper, element, opt_timeout) {
    var timeout = opt_timeout || 10;

    if (this.ignoreSynchronization || timeout === 0) {
        return element;
    }

    wrapper.driver.wait(function () {
        return element.isDisplayed().then(function (s) {
            return s === true;
        });
    }, timeout * 1000, 'Timed out waiting for element to display');
    return element;
}

/**
 * @param {webdriver.WebDriver} webdriver
 * @param {string=} opt_baseUrl A base URL to run get requests against.
 * @param {string=body} opt_rootElement
 * @constructor
 */
var DriverWrapper = function (webdriver, opt_baseUrl, server) {

    // Mix all other driver functionality into DriverWrapper.
    for (var method in webdriver) {
        if (!this[method] && typeof webdriver[method] == 'function') {
            mixin(this, webdriver, method);
        }
    }

    /**
     * The wrapped webdriver instance. Use this to interact with pages that do
     * not contain Angular (such as a log-in screen).
     *
     * @type {webdriver.WebDriver}
     */
    this.driver = webdriver;

    /**
     * Helper function for finding elements by id.
     *
     * @type {function(string): ElementFinder}
     */
    this.id = buildIdHelper(this);

    /**
     * Helper function for finding elements by id.
     *
     * @type {function(string): ElementFinder}
     */
    this.id_ = buildIdHelperWithoutWait(this);

    /**
     * Helper function for finding elements by css.
     *
     * @type {function(string): ElementFinder}
     */
    this.css = buildCssHelper(this);

    /**
     * Helper function for finding elements by css.
     *
     * @type {function(string): ElementFinder}
     */
    this.css_ = buildCssHelperWithoutWait(this);

    /**
     * Helper function for finding elements by css.
     *
     * @type {function(string): ElementFinder}
     */
    this.$ = buildCssHelper(this);

    /**
     * Helper function for finding elements by css.
     *
     * @type {function(string): ElementFinder}
     */
    this.$_ = buildCssHelperWithoutWait(this);

    /**
     * Helper function for finding arrays of elements by css.
     *
     * @type {function(string): ElementArrayFinder}
     */
    this.$$ = buildMultiCssHelper(this);

    /**
     * All get methods will be resolved against this base URL. Relative URLs are =
     * resolved the way anchor tags resolve.
     *
     * @type {string}
     */
    this.baseUrl = opt_baseUrl || '';
};


/**
 * See webdriver.WebDriver.get
 */
DriverWrapper.prototype.get = function (destination, opt_timeout) {
    var timeout = opt_timeout || 10;
    var self = this;

    destination = url.resolve(this.baseUrl, destination);

    if (this.ignoreSynchronization) {
        return this.driver.get(destination);
    }

    this.driver.get('about:blank');
    this.driver.executeScript(
        'window.name = "' + DEFER_LABEL + '" + window.name;' +
            'window.location.assign("' + destination + '");');

    // At this point, we need to make sure the new url has loaded before
    // we try to execute any asynchronous scripts.
    this.driver.wait(function () {
        return self.driver.getCurrentUrl().then(function (url) {
            return url !== 'about:blank';
        });
    }, timeout * 1000, 'Timed out waiting for page to load');

};

DriverWrapper.prototype.saveScreenshot = function (path, fs) {
    this.driver.takeScreenshot().then(function (data) {
        var base64Data = data.replace(/^data:image\/png;base64,/, "");
        fs.writeFile(path, base64Data, 'base64', function (err) {
            if (err) console.log(err);
        });
    });
};

DriverWrapper.prototype.resize = function (width, height) {
    this.driver.manage().window().setSize(width, height);
}


/**
 * Create a new instance of DriverWrapper by wrapping a webdriver instance.
 *
 * @param {webdriver.WebDriver} webdriver The configured webdriver instance.
 * @param {string=} opt_baseUrl A URL to prepend to relative gets.
 * @return {DriverWrapper}
 */

exports.getBrowser = function (browser, file) {
    var driver;
    var pathToSeleniumJar = file || (path.join(__dirname, '../', 'selenium/selenium-server-standalone-2.41.0.jar'));

    if (browser === 'chrome') {
        driver = new webdriver.Builder().
            withCapabilities(webdriver.Capabilities.chrome()).
            build();
        return new DriverWrapper(driver);
    } else if (browser === 'phantomjs') {
        driver = new webdriver.Builder().
            withCapabilities(webdriver.Capabilities.phantomjs()).
            build();
        return new DriverWrapper(driver);
    } else {
        console.log(__dirname);
        server = new remote.SeleniumServer(pathToSeleniumJar, {
            port: 4444
        });
        server.start();
        driver = new webdriver.Builder().
            withCapabilities({'browserName': browser}).
            usingServer(server.address()).
            build();
        return new DriverWrapper(driver, '', server);
    }

};

exports.quit = function (driver) {
    driver.quit();
    if (driver.server) {
        driver.server.stop();
    }
}
