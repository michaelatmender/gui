import React from 'react';
import PropTypes from 'prop-types';
import { Router, Route, Link } from 'react-router';
import Header from './header/header';
import LeftNav from './leftnav';

import getMuiTheme from 'material-ui/styles/getMuiTheme';
import RawTheme from '../themes/mender-theme.js';

import IdleTimer from 'react-idle-timer';
import { clearAllRetryTimers } from '../utils/retrytimer';

import { logout, updateMaxAge, expirySet }from '../auth';

var AppStore = require('../stores/app-store');
var AppActions = require('../actions/app-actions');

var createReactClass = require('create-react-class');
var isDemoMode = true;


function getState() {
  return {
    currentUser: AppStore.getCurrentUser(),
    uploadInProgress: AppStore.getUploadInProgress(),
    timeout: 900000, // 15 minutes idle time
  }
}

var App = createReactClass({
  childContextTypes: {
    location: PropTypes.object,
    muiTheme: PropTypes.object
  },
  getChildContext() { 
    var theme = getMuiTheme(RawTheme);
    return {
      muiTheme: theme,
      location: this.props.location
    };
  },
  getInitialState: function() {
    return getState();
  },
  componentWillMount: function() {
    AppStore.changeListener(this._onChange);
  },
  componentDidMount: function() {
    window.addEventListener('mousemove', updateMaxAge, false);
  },
  componentWillUnmount: function() {
    window.addEventListener('mousemove', updateMaxAge, false);
    AppStore.removeChangeListener(this._onChange);
  },
  _onChange: function() {
    this.setState(getState());
  },
  _onIdle: function() {
    if (expirySet()) {
      // logout user and warn
      if (this.state.currentUser && !this.state.uploadInProgress) {
        logout();
        AppActions.setSnackbar("Your session has expired. You have been automatically logged out due to inactivity.");
      } else if (this.state.currentUser && this.state.uploadInProgress) {
        updateMaxAge();
      }
    }
  },
  _changeTab: function(tab) {
    this.context.router.push(tab);
  },
  render: function() {

    return (
      <IdleTimer
        ref="idleTimer"
        element={document}
        idleAction={this._onIdle}
        timeout={this.state.timeout}
        format="MM-DD-YYYY HH:MM:ss.SSS">

        <div className="wrapper">
          <div className="header">
            <Header currentTab={this.props.location.pathname} demo={isDemoMode} history={this.props.history} isLoggedIn={(this.state.currentUser||{}).hasOwnProperty("email")} />
          </div>
          <div className="leftFixed leftNav">
            <LeftNav currentTab={this.props.location.pathname} changeTab={this._changeTab} />
          </div>
          <div className="rightFluid container">
            {React.cloneElement(this.props.children, { isLoggedIn:(this.state.currentUser||{}).hasOwnProperty("email") })}
          </div>
        </div>
      </IdleTimer>
    )
  }
});

App.contextTypes = {
  router: PropTypes.object,
  location: PropTypes.object,
};


module.exports = App;
