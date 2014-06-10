var util = require('util');
var PageObject = require('../../PageObject');

var mixin = function (to, from, fnName) {
    to[fnName] = function () {
        return from[fnName].apply(from, arguments);
    };
};

var ExamplePage = function (context) {
    PageObject.call(this, context);

    for (var method in PageObject) {
        if (!this[method] && typeof PageObject[method] == 'function') {
            mixin(this, PageObject, method);
        }
    }
    this.element('locationInput', '#input-location');
    this.element('searchButton', '#button-search');

    ExamplePage.prototype.locationSearch = function () {
        this.visit('http://m.opentable.com/#/location');
        this.locationInput().click();
        this.locationInput().sendKeys('San Francisco, CA, United States');
        this.searchButton().click();
    };
};

util.inherits(ExamplePage, PageObject);

module.exports = ExamplePage;