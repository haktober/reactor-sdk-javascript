/*
Copyright 2019 Adobe. All rights reserved.
This file is licensed to you under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License. You may obtain a copy
of the License at http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed under
the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
OF ANY KIND, either express or implied. See the License for the specific language
governing permissions and limitations under the License.
*/

import reactor from './reactor';
import helpers from './helpers';

// Environments
// https://developer.adobelaunch.com/api/environments
helpers.describe('Environment API', function() {
  var theProperty;
  var theAdapter;
  var envSleepy;
  var envSneezy;
  var envGrumpy;
  var setupFailed = true; // in case beforeAll dies before setting this variable

  beforeAll(async function setUpTestObjects() {
    theProperty = await helpers.createTestProperty('Environment-Testing');
    if (!theProperty) return;
    const p = theProperty.id;
    theAdapter = await helpers.createTestSftpAdapter(p, 'Environment-Testing');
    if (!theAdapter) return;
    const a = theAdapter.id;
    envSleepy = await helpers.createTestEnvironment(p, 'Sleepy', a);
    envSneezy = await helpers.createTestEnvironment(p, 'Sneezy', a);
    envGrumpy = await helpers.createTestEnvironment(p, 'Grumpy', a);
    if (!envSleepy || !envSneezy || !envGrumpy) return;
    setupFailed = false;
  });

  var originalTimeout;
  beforeEach(function() {
    originalTimeout = jasmine.DEFAULT_TIMEOUT_INTERVAL;
    jasmine.DEFAULT_TIMEOUT_INTERVAL = 60000;
  });

  afterEach(function() {
    jasmine.DEFAULT_TIMEOUT_INTERVAL = originalTimeout;
  });

  // Create an Environment
  // https://developer.adobelaunch.com/api/environments/create/
  helpers.it('creates a new Environment', async function() {
    // Three environments should have been created in beforeAll().
    if (setupFailed) return;
    expect(envSleepy.id).toMatch(helpers.idEN);
    expect(envSneezy.id).toMatch(helpers.idEN);
    expect(envGrumpy.id).toMatch(helpers.idEN);
  });

  // Delete an Environment
  // https://developer.adobelaunch.com/api/environments/delete/
  helpers.it('deletes an Environment', async function() {
    const [p, a] = [theProperty.id, theAdapter.id];
    const nonce = await helpers.createTestEnvironment(p, 'Mayfly', a);
    expect(nonce.attributes.name).toMatch(/mayfly/i);

    const deleteResponse = await reactor.deleteEnvironment(nonce.id);
    expect(deleteResponse).toBe(null);

    try {
      await reactor.getEnvironment(nonce.id);
      fail('getting a deleted environment should fail');
    } catch (error) {
      expect(error.status).toBe(404);
    }
  });

  // Get an Environment
  // https://developer.adobelaunch.com/api/environments/fetch/
  helpers.it('gets an Environment', async function() {
    if (setupFailed) return;
    const response = await reactor.getEnvironment(envSneezy.id);
    const sneezy = response.data;
    expect(sneezy.attributes.name).toBe(envSneezy.attributes.name);
  });

  // Get the Adapter
  // https://developer.adobelaunch.com/api/environments/adapter/
  helpers.it("gets an Environment's Adapter", async function() {
    if (setupFailed) return;
    const env = await helpers.createTestEnvironment(theProperty.id, 'Grady');
    const response = await reactor.getAdapterForEnvironment(env.id);
    expect(response.data).not.toBeUndefined();
    expect(response.data.id).toBe(env.associatedAdapterId);
    expect(response.data.type).toBe('adapters');
  });

  // Get the Adapter relationship
  // https://developer.adobelaunch.com/api/environments/adapter_relationship/
  helpers.it("gets an Environment's Adapter relationship", async function() {
    if (setupFailed) return;
    const env = await helpers.createTestEnvironment(theProperty.id, 'Kyrie');
    const response = await reactor.getAdapterRelationshipForEnvironment(env.id);
    expect(response.data).not.toBeUndefined();
    expect(response.data.id).toBe(env.associatedAdapterId);
    expect(response.data.type).toBe('adapters');
    expect(response.data.attributes).toBeUndefined();
  });

  // Get the Library
  // https://developer.adobelaunch.com/api/environments/fetch_library/
  helpers.it("gets the Environment's Library", async function() {
    if (setupFailed) return;

    // create a library
    const createResponse = await reactor.createLibrary(theProperty.id, {
      attributes: { name: 'Grumpy Library' },
      type: 'libraries'
    });
    const lib = createResponse.data.id;
    expect(lib).toMatch(helpers.idLB);

    // set the library's environment to envGrumpy
    const env = envGrumpy.id;
    const rel = await reactor.setEnvironmentRelationshipForLibrary(lib, env);
    expect(rel.data.id).toBe(env);

    // test getLibraryForEnvironment
    var response = await reactor.getLibraryForEnvironment(env);
    expect(response.data).not.toBeUndefined();
    expect(response.data.id).toBe(lib);
    expect(response.data.attributes.name).toMatch(/grumpy library/i);
  });

  // Get the Property
  // https://developer.adobelaunch.com/api/environments/property/
  helpers.it("gets an Environment's Property", async function() {
    if (setupFailed) return;
    const response = await reactor.getPropertyForEnvironment(envGrumpy.id);
    expect(response.data).not.toBeUndefined();
    expect(response.data.id).toBe(theProperty.id);
    expect(response.data.type).toBe('properties');
    expect(response.data.attributes.name).toBe(theProperty.attributes.name);
  });

  // List Builds
  // https://developer.adobelaunch.com/api/environments/builds/
  helpers.it("lists an Environment's builds", async function() {
    // Create an library, adapter, environment
    const lib = await helpers.createTestLibrary(theProperty.id, 'Jack');
    const env = await helpers.makeLibraryEnvironment(lib, 'Jill', 'Akamai');
    await helpers.addCoreToLibrary(theProperty, lib);
    const buildId = await helpers.buildLibrary(lib);
    if (buildId === null) return;

    // test listBuildsForEnvironment
    const response = await reactor.listBuildsForEnvironment(env.id);
    const allIds = response.data.map(build => build.id);
    expect(allIds).toContain(buildId);
  });

  // List Environments for a Property
  // https://developer.adobelaunch.com/api/environments/list/
  helpers.it('lists all Environments', async function() {
    if (setupFailed) return;
    // Make sure all three environments show up in the list of Environments on Property
    const listResponse = await reactor.listEnvironmentsForProperty(
      theProperty.id
    );
    const allIds = listResponse.data.map(resource => resource.id);
    expect(allIds).toContain(envSleepy.id);
    expect(allIds).toContain(envSneezy.id);
    expect(allIds).toContain(envGrumpy.id);
  });
  helpers.it('lists filtered Environments', async function() {
    if (setupFailed) return;
    var filteredResponse = await reactor.listEnvironmentsForProperty(
      theProperty.id,
      { 'filter[name]': 'LIKE ee' }
    );
    const twoIds = filteredResponse.data.map(resource => resource.id);
    expect(twoIds).toContain(envSleepy.id);
    expect(twoIds).toContain(envSneezy.id);
    expect(twoIds).not.toContain(envGrumpy.id);
  });

  // Update an Environment
  // https://developer.adobelaunch.com/api/environments/update/
  helpers.it('updates an Environment', async function() {
    const theEnvironment = await helpers.createTestEnvironment(
      theProperty.id,
      'Blick',
      theAdapter.id
    );
    let response = await reactor.updateEnvironment({
      attributes: {
        name: theEnvironment.attributes.name.replace('Blick', 'Blick Updated')
      },
      id: theEnvironment.id,
      type: 'environments'
    });
    const updatedEnvironment = response.data;
    expect(updatedEnvironment.id).toBe(theEnvironment.id);
    expect(updatedEnvironment.attributes.name).toMatch(/Updated/);

    response = await reactor.getEnvironment(theEnvironment.id);
    const freshlyLoaded = response.data;
    expect(freshlyLoaded.attributes.name).toMatch(/Updated/);
  });
});
