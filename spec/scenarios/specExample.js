var ExamplePage = require('../helpers/page_objects/examplePage'),
           test = require('../../lib/runner');

test.describe('OpenTable Location Search', function() {

  var examplePage;
  test.beforeEach(function(){
    examplePage = new ExamplePage();
  });

  test.afterEach(function() {
    examplePage.close();
  });

  test.it('should append query to title', function() {
    examplePage.locationSearch();
  });
});