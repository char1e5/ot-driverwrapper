var driver = require('../../lib/driverwrapper'),
    fs = require('fs'),
    browser;

var PageObject = function (context) {
    browser = driver.getBrowser('chrome');
    this.browser = browser;
}

PageObject.prototype.visit = function (url) {
    browser.get(url);
};

PageObject.prototype.saveScreenshot = function (path) {
    browser.saveScreenshot(path, fs)
};

PageObject.element = function (method, css) {
    this.prototype[method] = function () {
        return browser.$(css);
    };
};

PageObject.prototype.close = function () {
    driver.quit(browser);
}

module.exports = PageObject;