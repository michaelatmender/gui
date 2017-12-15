import React from 'react';
import PropTypes from 'prop-types';
import { Router, Route } from 'react-router';
import HelpTopics from './helptopics';
import LeftNav from './left-nav';
import ConnectingDevices from './connecting-devices';
import ProvisionDemo from './connecting-devices/provision-a-demo';
import VirtualDevice from './connecting-devices/virtual-device';
import RaspberryPi from './connecting-devices/raspberry-pi-3';
import BeagleBoneBlack from './connecting-devices/beagleboneblack';
import DemoArtifacts from './connecting-devices/demo-artifacts';
import BuildYocto from './connecting-devices/build-with-yocto';
import { isEmpty } from '../../helpers';

var createReactClass = require('create-react-class');
var AppStore = require('../../stores/app-store');
var AppActions = require('../../actions/app-actions');


var components = {
  "connecting-devices": {
    title: "Connecting devices",
    component: ConnectingDevices,
    "provision-a-demo": {
      title: "Provision a demo device",
      component: ProvisionDemo,
      "virtual-device": {
        title: "Virtual device",
        component: VirtualDevice,
      },
      "raspberry-pi-3": {
        title: "Rasberry Pi 3",
        component: RaspberryPi,
      },
      "beagleboneblack": {
        title: "BeagleBone Black",
        component: BeagleBoneBlack,
      },
    },
    "demo-artifacts": {
      title: "Download demo artifacts",
      component: DemoArtifacts,
    },
    "build-with-yocto": {
      title: "Build with Yocto",
      component: BuildYocto,
    },
  },
};

var Help =  createReactClass({

  getInitialState: function() {
    return {
      snackbar: AppStore.getSnackbar(),
      hasMultitenancy: AppStore.hasMultitenancy(),
    };
  },
  componentDidMount: function() {
    if (this.state.hasMultitenancy) {
      this._getUserOrganization();
    }
  },
  _getUserOrganization: function() {
    var self = this;
    var callback = {
      success: function(org) {
        self.setState({org: org});
        self._getLinks(org.tenant_id);
      },
      error: function(err) {
        console.log("Error: " +err);
      }
    };
    AppActions.getUserOrganization(callback);
  },

  _getLinks: function(id) {
    var self = this;
    var callback = {
      success: function(response) {
        self.setState({links: response});
      },
      error: function(err) {
        console.log("Error: " +err);
      }
    };
    AppActions.getHostedLinks(id, callback);
  },

  componentWillMount: function() {
    AppStore.changeListener(this._onChange);
  },

  componentWillUnmount: function() {
    AppStore.removeChangeListener(this._onChange);
  },

  _onChange: function() {
    this.setState(this.getInitialState());
  },

  changePage: function (path) {
    this.context.router.push(path);
  },

  render: function() {
    var ComponentToShow = HelpTopics;
  
    if (this.props.params.splat) {
      var splitsplat = this.props.params.splat.split("/");
      var copyOfComponents = components;

      for (var i=0;i<splitsplat.length; i++) {
        if (i === splitsplat.length-1) {
          ComponentToShow = copyOfComponents[splitsplat[i]].component;
        } else {
          copyOfComponents = copyOfComponents[splitsplat[i]];
        }
      }
      
    }

    return (
      <div className="margin-top">
        <div className="leftFixed">
          <LeftNav pages={components} changePage={this.changePage} />
        </div>
        <div className="rightFluid padding-right">
          <div className="margin-top-small">
            <ComponentToShow org={this.state.org} links={this.state.links} hasMultitenancy={this.state.hasMultitenancy} isEmpty={isEmpty} pages={components} changePage={this.changePage} />
          </div>
        </div>
      </div>
    )
  }

});

Help.contextTypes = {
  router: PropTypes.object,
};

module.exports = Help;