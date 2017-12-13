import React from 'react';
import PropTypes from 'prop-types';
import { Router, Route } from 'react-router';

// material ui
import { List, ListItem }  from 'material-ui/List';
import Subheader from 'material-ui/Subheader';

var createReactClass = require('create-react-class');

var LeftNav =  createReactClass({
  getInitialState: function () {
    return {
      links: [] 
    };
  },

  componentDidMount: function () {
     // generate sidebar links
    this._setNavLinks();
  },

  componentDidUpdate: function(prevProps, prevState) {

  },

  _clickLink: function (path) {
    console.log("clicked, " +path);
    this.context.router.push(path);
  },

  _setNavLinks: function () {
    var self = this;
    var links = [];

    // build array of link list components
    function eachRecursive(obj, path, level) {
        for (var k in obj) {
          if (typeof obj[k] == "object" && obj[k] !== null && k!=="component") {
              path = path ? path+"/"+k : "/help/"+k;
              links.push({title: obj[k].title, level:level, path:path});
              self.setState({links:links});
              eachRecursive(obj[k], path, level+1);
          } else {
            // blah
          }
        }
      }
      eachRecursive(self.props.pages, "", 0);
  },
 
  render: function () {
    var self = this;
    var nav = self.state.links.map(function(link, index) {
      var bgColor = self.context.router.isActive(link.path) ? "#E7E7E7" : "#FFFFFF";
      return (
        <ListItem primaryText={link.title} style={{paddingLeft: link.level*16, backgroundColor: bgColor}} onClick={self._clickLink.bind(null, link.path)} key={link.path} />
      )
    });
    return (
        <div>
          <List>
            <Subheader>Help topics</Subheader>
            {nav}
          </List>
        </div>
    )
  }
});

LeftNav.contextTypes = {
  router: PropTypes.object
};

module.exports = LeftNav;