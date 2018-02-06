import React from 'react';
var createReactClass = require('create-react-class');

var Groups = require('./groups');
var GroupSelector = require('./groupselector');
var CreateGroup = require('./create-group');
var DeviceList = require('./devicelist');
var Filters = require('./filters');
var Loader = require('../common/loader');
var pluralize = require('pluralize');
var Pagination = require('rc-pagination');
var _en_US = require('rc-pagination/lib/locale/en_US');

import { setRetryTimer, clearRetryTimer, clearAllRetryTimers } from '../../utils/retrytimer';
import { preformatWithRequestID } from '../../helpers.js';

var AppStore = require('../../stores/app-store');
var AppActions = require('../../actions/app-actions');

import { Tabs, Tab } from 'material-ui/Tabs';
import Snackbar from 'material-ui/Snackbar';
import Dialog from 'material-ui/Dialog';
import TextField from 'material-ui/TextField';
import FlatButton from 'material-ui/FlatButton';
import RaisedButton from 'material-ui/RaisedButton';
import FontIcon from 'material-ui/FontIcon';

var AcceptedDevices = createReactClass({
	getInitialState() {
		return {
			groups: AppStore.getGroups(),
	  		selectedGroup: AppStore.getSelectedGroup(),
	  		addGroup: false,
	  		removeGroup: false,
	  		groupInvalid: true,
	  		filters: AppStore.getFilters(),
	  		attributes: AppStore.getAttributes(),
	  		snackbar: AppStore.getSnackbar(),
	  		createGroupDialog: false,
	  		devices: [],
	  		pageNo: 1,
	  		pageLength: 20,
	  		loading: true,
	  		tmpDevices: [],
		};
	},

	componentDidMount() {
		// Get groups
		this._refreshAll();
	},

	componentDidUpdate: function(prevProps, prevState) {
	    if (prevState.selectedGroup !== this.state.selectedGroup) {
	      //clearInterval(this.deviceTimer);
	      this._refreshGroups();
	      //this.deviceTimer = setInterval(this._refreshDevices, this.state.refreshDeviceLength);
	    }
	},

	_refreshAll: function() {
		this._refreshGroups();
    	this._getDevices();
	},


	 /*
	 * Groups
	 */
	_refreshGroups: function() {
	    var self = this;
	    var groupDevices = {};
	    var callback = {
	      success: function (groups) {
	        self.setState({groups: groups});

	        for (var i=0;i<groups.length;i++) {
	          groupDevices[groups[i]] = 0;
	          setNum(groups[i], i);
	          function setNum(group, idx) {
	            
	            AppActions.getNumberOfDevicesInGroup(function(noDevs) {
	              groupDevices[group] = noDevs;
	              self.setState({groupDevices: groupDevices});
	            }, group);
	          }
	        }

	      },
	      error: function(err) {
	        console.log(err);
	      }
	    };
	    AppActions.getGroups(callback);
	},

	_handleGroupChange: function(group, numDev) {
		var self = this;
		this.setState({loading: true, selectedGroup: group, groupCount: numDev, pageNo:1}, function() {
			self._getDevices();
		});
	},

	_toggleDialog: function(ref) {
		var state = {};
    	state[ref] = !this.state[ref];
    	this.setState(state);
	},

	_removeCurrentGroup: function() {
	    var self = this;
	    //self.props.pauseRefresh(true);
	    var callback = {
	      success: function(devices, link) {
	      	// should handle "next page"
	        // returns all group devices ids
	        for (var i=0;i<devices.length; i++) {
	          self._removeSingleDevice(i, devices.length, devices[i].id, i===devices.length-1 ? finalCallback : null);
	        }
	      },
	      error: function(err) {
	        console.log(err);
	        //self.props.pauseRefresh(false);
	      }
    };

	    AppActions.getDevices(callback, 1, 100, this.state.selectedGroup, null, true);
	    var finalCallback = function() {

	      //self.props.pauseRefresh(false);
	      AppActions.setSnackbar("Group was removed successfully");
	     	self._toggleDialog("removeGroup");
	     	self.setState({selectedGroup: null, pageNo:1, groupCount: self.state.acceptedDevices}, function() {
	     		self._refreshAll();
	     	});
	    };
	},

 	_removeSingleDevice: function(idx, length, device, parentCallback) {
 		// remove single device from group
    var self = this;
    var callback = {
      success: function(result) {
        if (idx===length-1) {
          // if parentcallback, whole group is being removed
          if (parentCallback && typeof parentCallback === "function") {
            // whole group removed
            parentCallback();
          } else if (length === self.props.devices.length) {
            // else if all in group were selected and deleted, refresh group
            self.props.groupsChanged();
            self.setState({openSnack: true, snackMessage: "Group was removed", selectedRows: []});
          } else {
            self.props.groupsChanged(self.state.selectedGroup);
            self.setState({openSnack: true, snackMessage: "Device was removed from the group", selectedRows: []});
            self.setState({ selectedRows: [] });
          }
        }
      },
      error: function(err) {
        console.log(err);
      }
    };
    AppActions.removeDeviceFromGroup(device, this.state.selectedGroup, callback);
  },


	/*
	* Devices
	*/ 
	
	_getDevices: function() {
	    var self = this;
	    if (!this.state.selectedGroup) {
	      // no group selected, get all accepted
	      this._getAllAccepted();
	    } else {
	       var callback =  {
	        success: function(devices) {
	          self.setState({devices: devices, loading: false, pageLoading: false});
	        },
	        error: function(error) {
	          console.log(err);
	          var errormsg = err.error || "Please check your connection.";
	          self.setState({loading: false});
	             // setRetryTimer(err, "devices", "Devices couldn't be loaded. " + errormsg, self.state.refreshDeviceLength);
	        }
	      };

	      AppActions.getDevices(callback, this.state.pageNo, this.state.pageLength, this.state.selectedGroup);
	    }
	},
	  
	_getAllAccepted: function() {
	    var self = this;
	    var callback =  {
	      success: function(devices) {
	        self.setState({devices: devices});
	        if (devices.length) {
	          // for each device get inventory
	          devices.forEach( function(dev, index) {
	            self._getInventoryForDevice(dev, function(device) {
	              devices[index].attributes = device.attributes;
	              devices[index].updated_ts = device.updated_ts;
	              if (index===devices.length-1) {
	                self.setState({devices:devices, loading: false, pageLoading: false});
	              }
	            });
	          });   

	        } else {
	           self.setState({loading: false});
	        }
	      },
	      error: function(error) {
	        console.log(err);
	        var errormsg = err.error || "Please check your connection.";
	        self.setState({loading: false});
	           // setRetryTimer(err, "devices", "Devices couldn't be loaded. " + errormsg, self.state.refreshDeviceLength);
	      }
	    };

	    AppActions.getDevicesByStatus(callback, "accepted", this.state.pageNo, this.state.pageLength);
	},


	_getInventoryForDevice: function(device, originCallback) {
	    // get inventory for single device
	    var callback = {
	      success: function(device) {
	        originCallback(device);
	      },
	      error: function(err) {
	        console.log(err);
	        originCallback(null);
	      }
	    };
	    AppActions.getDeviceById(device.device_id, callback);
	},

	_handlePageChange: function(pageNo) {
    	var self = this;
    	self.setState({pageLoading: true, pageNo: pageNo}, () => {self._getDevices()});
  	},


  	// Edit groups from device selection
  	_addDevicesToGroup: function(devices) {
  		console.log(devices);
  		var self = this;
  		// (save selected devices in state, open dialog)
  		this.setState({tmpDevices: devices}, function() {
  			self._toggleDialog("addGroup");
  		});
  	},

  	_validate: function(invalid, group) {
	    var name = invalid ? "" : group;
	    this.setState({groupInvalid: invalid, tmpGroup: name});
	},
	_changeTmpGroup: function(group) {
		var self = this;
    	this.setState({selectedField: group, tmpGroup: group});
  	},
  	_addToGroup: function() {
  		this._addListOfDevices(this.state.tmpDevices, this.state.selectedField || this.state.tmpGroup);
  	},



	_addListOfDevices: function(rows, group) {
		console.log(rows, group);
		var self = this;
	    for (var i=0;i<rows.length;i++) {
	      var group = encodeURIComponent(group);
	      self._addDeviceToGroup(group, self.state.devices[rows[i]], i, rows.length);
	    }
	},

	_addDeviceToGroup(group, device, idx, length) {
	    var self = this;
	    var callback = {
	      success: function() {
	        if (idx === length-1) {
	          // reached end of list
	          self.setState({createGroupDialog: false, addGroup: false, tmpGroup: "", selectedField:""});
	          AppActions.setSnackbar("The group was updated successfully");
	          self._handleGroupChange(group, length);
	        }
	      },
	      error: function(err) {
	        console.log(err);
	        var errMsg = err.res.body.error || "";
	        AppActions.setSnackbar(preformatWithRequestID(err.res, "Group could not be updated: " + errMsg));
	      }
	    };
	    console.log(device);
	    AppActions.addDeviceToGroup(group, device.device_id || device.id, callback);
	},


	render: function() {
		// Add to group dialog 
		var addActions = [
	      <div style={{marginRight:"10px", display:"inline-block"}}>
	        <FlatButton
	          label="Cancel"
	          onClick={this._toggleDialog.bind(null, "addGroup")} />
	      </div>,
	      <RaisedButton
	        label="Add to group"
	        primary={true}
	        onClick={this._addToGroup}
	        ref="save" 
	        disabled={this.state.groupInvalid} />
	    ];

	  	var removeActions = [
	      <div style={{marginRight:"10px", display:"inline-block"}}>
	        <FlatButton
	          label="Cancel"
	          onClick={this._toggleDialog.bind(null, "removeGroup")} />
	      </div>,
	      <RaisedButton
	        label="Remove group"
	        primary={true}
	        onClick={this._removeCurrentGroup} />
	    ];

	  	var groupCount = this.state.groupCount ? this.state.groupCount : this.props.acceptedDevices;

	    var styles = {
	      exampleFlatButtonIcon: {
	        height: '100%',
	        display: 'inline-block',
	        verticalAlign: 'middle',
	        float: 'left',
	        paddingLeft: '12px',
	        lineHeight: '36px',
	        marginRight: "-6px",
	        color:"#679BA5",
	        fontSize:'16px'
	      },
	      exampleFlatButton: {
	        fontSize:'12px',
	        marginLeft:"10px",
	        float:"right",
	        marginTop: "-10px",
	      },
		};

		return (	
			<div className="margin-top">
				<Filters attributes={this.state.attributes} filters={this.state.filters} onFilterChange={this._onFilterChange} />
					
				<div className="leftFixed">
		          	<Groups
		            openGroupDialog={this._toggleDialog.bind(null, "createGroupDialog")}
		            changeGroup={this._handleGroupChange}
		            groups={this.state.groups}
		            groupDevices={this.state.groupDevices}
		            selectedGroup={this.state.selectedGroup}
		            acceptedDevices={this.props.acceptedDevices}
		            showHelptips={this.state.showHelptips} />
	        	</div>
	        	<div className="rightFluid">
		            <FlatButton onClick={this._toggleDialog.bind(null, "removeGroup")} style={styles.exampleFlatButton} className={this.state.selectedGroup ? null : 'hidden' } label="Remove group" labelPosition="after">
		          		<FontIcon style={styles.exampleFlatButtonIcon} className="material-icons">delete</FontIcon>
		        		</FlatButton>
		          	
		          	<DeviceList addDevicesToGroup={this._addDevicesToGroup} loading={this.state.loading} rejectOrDecomm={this.props.rejectOrDecomm} currentTab={this.props.currentTab} acceptedDevices={this.props.acceptedDevices} groupCount={groupCount}  styles={this.props.styles} group={this.state.selectedGroup} devices={this.state.devices} />
		          	
		          	{this.state.devices.length && !this.state.loading ?
		          	<div className="margin-top">
		           		<Pagination locale={_en_US} simple pageSize={this.state.pageLength} current={this.state.pageNo} total={groupCount} onChange={this._handlePageChange} />
		             		{this.state.pageLoading ?  <div className="smallLoaderContainer"><Loader show={true} /></div> : null}
		          	</div> : null }
	          	</div>



		        <Dialog
		          ref="addGroup"
		          open={this.state.addGroup}
		          title="Add selected devices to group"
		          actions={addActions}
		          autoDetectWindowHeight={true}
		          bodyStyle={{fontSize: "13px"}}>  
		          <GroupSelector devices={this.state.tmpDevices.length} willBeEmpty={this.state.willBeEmpty} tmpGroup={this.state.tmpGroup} selectedGroup={this.state.selectedGroup} changeSelect={this._changeTmpGroup} validateName={this._validate} groups={this.state.groups} selectedField={this.state.selectedField} />
		        </Dialog>

		        <Dialog
		        	ref="removeGroup"
		          open={this.state.removeGroup}
		          title="Remove this group?"
		          actions={removeActions}
		          autoDetectWindowHeight={true}
		          bodyStyle={{fontSize: "13px"}}>  
		          <p>This will remove the group from the list. Are you sure you want to continue?</p>
		        </Dialog>


		        <CreateGroup
		        	ref="createGroupDialog"
		        	toggleDialog={this._toggleDialog}
			        open={this.state.createGroupDialog}
			        groups={this.state.groups}
			        changeGroup={this._handleGroupChange}
			        addListOfDevices={this._addListOfDevices}
		         />

		        <Snackbar
		          open={this.state.snackbar.open}
		          message={this.state.snackbar.message}
		          autoHideDuration={8000}
		        />
			</div>

		);

	}

});

module.exports = AcceptedDevices;