import React from 'react';
import CopyToClipboard from 'react-copy-to-clipboard';
import IconButton from '@material-ui/core/IconButton';
import CopyPasteIcon from '@material-ui/icons/FileCopy';

export default class BuildDemoArtifact extends React.Component {
  constructor(props, context) {
    super(props, context);
    this.state = {
      executable: false
    };
  }

  _copied(ref) {
    var self = this;
    var toSet = {};
    toSet[ref] = true;
    self.setState(toSet);
    setTimeout(() => {
      toSet[ref] = false;
      self.setState(toSet);
    }, 5000);
  }

  render() {

    var executable = `chmod +x mender-artifact \nchmod +x file-install-artifact-gen`;
    var generate = `ARTIFACT_NAME="demo-webserver-2.0" \nDEVICE_TYPE="*" \nOUTPUT_PATH="demo_webserver-2.0.mender" \nDEST_DIR="/opt/installed-by-file-installer/" \nFILE_TREE="dir-to-deploy" \n/file-install-artifact-gen -n` + '${ARTIFACT_NAME} -t ${DEVICE_TYPE} -d ${DEST_DIR} -o ${OUTPUT_PATH} ${FILE_TREE}';
  
    return (
      <div>
        <h2>Building the demo application update Artifact</h2>
        
   
        <p>If you have been following the tutorial tooltips to deploy your first application update, the third step is to build and deploy your own Artifact to your device.</p>

        <h3>Download demo application</h3>
        <p>For the demo tutorial, we provided you with a demo artifact that runs a simple web server on your device.
        You can use that application to learn how to build a new Artifact.</p>

        <p>Download both <a href="" target="_blank">mender-artifact</a> and <a href="" target="_blank">file-install-artifact-gen</a> then make them executable by running:</p>

        <div>
          <div className="code">
            <CopyToClipboard text={executable} onCopy={() => this._copied('executable')}>
              <IconButton style={{ float: 'right', margin: '-20px 0 0 10px' }}>
                <CopyPasteIcon/>
              </IconButton>
            </CopyToClipboard>
            <span style={{ wordBreak: 'break-word' }}>{executable}</span>
          </div>

          <p>{this.state.executable ? <span className="green fadeIn">Copied to clipboard.</span> : null}</p>
        </div>


        <h3>Edit the contents</h3>
        <p>Extract the <span className="code">demo_webserver.mender</span> file you just downloaded, and cd to the extracted folder so you can see the <i>index.html</i> file within.</p>
        <p>Replace the contents of <i>index.html</i> with a simple string (e.g. &quot;Hello world&quot;), so you will be able to easily see the change when the webpage content is updated.</p>

        <p>Now, you can create a new version of the demo webserver application with this modified <i>index.html</i> file. Generate a new Artifact by copying & pasting:</p>
        <div>
          <div className="code">
            <CopyToClipboard text={generate} onCopy={() => this._copied('generate')}>
              <IconButton style={{ float: 'right', margin: '-20px 0 0 10px' }}>
                <CopyPasteIcon/>
              </IconButton>
            </CopyToClipboard>
            <span style={{ wordBreak: 'break-word' }}>{generate}</span>
          </div>

          <p>{this.state.generate ? <span className="green fadeIn">Copied to clipboard.</span> : null}</p>
        </div>

        <p>You should now have a new Artifact file called <span className="code">demo-webserver-2.0.mender</span>!</p>
        <p>If you upload this Artifact to the Mender server, it will create a new Release. You can then deploy this &quot;2.0&quot; Release of the webserver demo to your device, and when it has updated successfully you should see the page content will have been replaced with the &quote;Hello world&quote; string you modified.
        </p>
       
      </div>
    );
  }
}
