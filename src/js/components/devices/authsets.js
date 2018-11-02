import React from 'react';
var createReactClass = require('create-react-class');

var AppActions = require('../../actions/app-actions');
var Authsetlist = require('./authsetlist');
var ConfirmDecommission = require('./confirmdecommission');
import { preformatWithRequestID } from '../../helpers.js';

// material ui
var mui = require('material-ui');
import IconButton from 'material-ui/IconButton';
import RaisedButton from 'material-ui/RaisedButton';
import FlatButton from 'material-ui/RaisedButton';

import TrashIcon from 'react-material-icons/icons/action/delete';


var Authsets = createReactClass({
	getInitialState() {
		return {
			active: [],
			inactive: [],
		};
	},

	componentDidMount() {
		this._getActiveAuthsets(this.props.device.auth_sets);
	},

	_getActiveAuthsets: function(authsets) {
		// for each authset compare the device status and if it matches authset status, put it in correct listv
		var self = this;
		var active = [], inactive = [];
		for (var i=0;i<authsets.length; i++) {
			if (authsets[i].status === self.props.device.status) {
				active.push(authsets[i]);
			} else {
				inactive.push(authsets[i]);
			}
		}
		self.setState({active: active, inactive: inactive});
	},


	updateAuthset: function(authset, newStatus) {
		console.log("Updating authset to " + newStatus);
		this.setState({loading: authset.id});
		// on finish, change "loading" back to null
		if (newStatus==="dismiss") {
			this.deleteAuthset(authset);
		} else {
			// call API to update authset
			// refresh - call appactions or send up to parent?
		}

	},

	deleteAuthset: function(authset) {
		console.log("dismissing! If this is only one, close dialog?");
		// call API to dismiss authset
		// refresh or if only authset, call parent to close dialog and refresh devices
	},

	_showConfirm: function() {
		var decommission = !this.state.decommission;
		this.setState({decommission: decommission});
	},
	
	render: function() {
		var self = this;
		var activeList = <Authsetlist confirm={this.updateAuthset} loading={this.state.loading} device={this.props.device} active={true} authsets={this.state.active} />
		var inactiveList = <Authsetlist confirm={this.updateAuthset} loading={this.state.loading} device={this.props.device} hideHeader={this.state.active.length} authsets={this.state.inactive} />

		var decommission = (
      <div className="float-right">
        <FlatButton label="Decommission device" secondary={true} onClick={this._showConfirm} icon={<TrashIcon style={{height:"18px", width:"18px", verticalAlign:"middle"}}/>}/>
      </div>
    );
    if (this.state.decommission) {
      decommission = (
        <ConfirmDecommission cancel={this._showConfirm} decommission={this._decommissionHandler} />
      );
    }

		return (
      <div style={{minWidth:"900px"}}>
      	{(this.props.device.status === "accepted" || this.props.device.status === "rejected") ? decommission : null}

      	<div className="margin-bottom-small" style={{fontSize: "15px"}}>{this.props.id_attribute || "Device ID"}: {this.props.id_value}</div>

      	<div className="clear">
		      {this.state.active.length ? activeList : null }

			    <div className="margin-top-large margin-bottom auto"></div>

			    {this.state.inactive.length ?
			    	<div>
			    		<h4 className="align-center">Inactive authentication sets</h4>
			       {inactiveList}
			      </div>
			    : null }
		    </div>
      </div>
    )
	}
});

module.exports = Authsets;