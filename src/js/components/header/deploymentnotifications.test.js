import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import renderer from 'react-test-renderer';
import DeploymentNotifications from './deploymentnotifications';

it('renders correctly', () => {
  const tree = renderer
    .create(
      <MemoryRouter>
        <DeploymentNotifications />
      </MemoryRouter>
    )
    .toJSON();
  expect(tree).toMatchSnapshot();
});