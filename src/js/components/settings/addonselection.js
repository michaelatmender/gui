import React from 'react';

import { Checkbox } from '@material-ui/core';

import { ADDONS, PLANS } from '../../constants/appConstants';

const priceStyle = { fontSize: '1rem' };

export const AddOnSelection = ({ addons = [], updatedPlan = 'os', onChange }) => {
  const onAddOnClick = (e, name, enabled) => {
    if (e.target.tagName === 'A') {
      return;
    }
    let changedAddOns = addons.filter(item => item.name !== name);
    if (enabled) {
      changedAddOns.push({ name, enabled });
    }
    onChange(changedAddOns);
  };

  const isUpgrade = Object.keys(PLANS).indexOf(updatedPlan) < Object.keys(PLANS).length - 1;
  const noteStyle = { minWidth: isUpgrade ? 120 : 150 };
  return (
    <>
      <h3 className="margin-top-large">Get more features with add-ons</h3>

      <div className="flexbox column">
        <p>
          Extend Mender features with our add-ons. Select one or more from the list and submit to request add-ons to be added to your plan. We&apos;ll adjust
          your subscription and confirm it with you.
        </p>
        {Object.entries(ADDONS).map(([addOnName, addOn]) => {
          const isEnabled = addons.some(orgAddOn => orgAddOn.enabled && addOnName === orgAddOn.name);
          return (
            <div
              key={addOnName}
              className={`planPanel flexbox ${isEnabled ? 'active' : ''}`}
              style={{ alignItems: 'center', height: 'initial', marginTop: 10, width: 'initial' }}
              onClick={e => onAddOnClick(e, addOnName, !isEnabled)}
            >
              <Checkbox checked={isEnabled} />
              <div className="bold" style={noteStyle}>
                {addOn.title}
              </div>
              {isUpgrade && (
                <div className="flexbox column" style={noteStyle}>
                  <div className="link-color bold" style={priceStyle}>
                    {addOn.price}
                  </div>
                  <div>{addOn.deviceCount}</div>
                </div>
              )}
              <span className="info">{addOn.description}</span>
              <a className="margin-left-small" href="https://mender.io/plans/features" target="_blank" rel="noopener noreferrer">
                Learn more
              </a>
            </div>
          );
        })}
      </div>
    </>
  );
};

export default AddOnSelection;
