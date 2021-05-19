import axios from 'axios';
import * as fs from 'fs';
import * as https from 'https';
import * as path from 'path';
import jwtDecode from 'jwt-decode';
import { spawn } from 'child_process';
import { Page, BrowserContext } from 'playwright';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';

import { authenticator } from 'otplib';

const updateConfigFileWithUrl = (fileName, serverUrl = 'https://docker.mender.io', token = '', projectRoot) => {
  const connectConfigFile = fs.readFileSync(`dockerClient/${fileName}.json`, 'utf8');
  let connectConfig = JSON.parse(connectConfigFile);
  connectConfig.ServerURL = serverUrl;
  if (token) {
    connectConfig.TenantToken = token;
  }
  fs.writeFileSync(`${projectRoot}/dockerClient/${fileName}-test.json`, JSON.stringify(connectConfig));
};

export const startClient = async (baseUrl, token, count) => {
  const srippedBaseUrl = baseUrl.replace(/\/$/, '');
  let args = [
    '-inventory="device_type:qemux86-64,client_version:mender-2.2.0,artifact_name:release-v1,kernel:test Linux version,mac_enp0:12.34"',
    '-invfreq=5',
    '-pollfreq=5',
    `-count=${count}`,
    `-backend=${srippedBaseUrl}`
  ];
  if (token) {
    args.push(`-tenant=${token}`);
  }
  console.log(`starting using: ./mender-stress-test-client ${args.join(' ')}`);
  let child = spawn('./mender-stress-test-client', args);
  child.on('error', err => console.error(`${err}`));
  child.on('message', err => console.error(`${err}`));
  child.on('spawn', err => console.error(`${err}`));
  // child.stdout.on('data', data => {
  //   console.log(`stdout mstc: ${data}`);
  // });
  child.stderr.on('data', data => {
    console.error(`stderr mstc: ${data}`);
  });
  child.on('close', code => {
    console.log(`child process exited with code ${code}`);
  });
};

export const startDockerClient = async (baseUrl, token) => {
  const projectRoot = process.cwd();
  const srippedBaseUrl = baseUrl.replace(/\/$/, '');
  updateConfigFileWithUrl('mender', srippedBaseUrl, token, projectRoot);
  updateConfigFileWithUrl('mender-connect', srippedBaseUrl, token, projectRoot);
  // NB! to run the tests against a running local Mender backend, uncomment & adjust the following
  // const localNetwork = ['--network', 'menderintegration_mender'];
  const localNetwork = baseUrl.includes('docker.mender.io')
    ? ['--network', 'gui-tests_mender', '-v', `${process.env.INTEGRATION_PATH}/certs/api-gateway/cert.crt:/certs/hosted.pem`]
    : ['-v', `${projectRoot}/hosted.pem:/certs/hosted.pem`];
  let args = [
    'run',
    '--name',
    'connect-client',
    ...localNetwork,
    '-v',
    `${projectRoot}/dockerClient/artifact_info:/etc/mender/artifact_info`,
    '-v',
    `${projectRoot}/dockerClient/device_type:/var/lib/mender/device_type`,
    '-v',
    `${projectRoot}/dockerClient/mender-test.json:/etc/mender/mender.conf`,
    '-v',
    `${projectRoot}/dockerClient/mender-connect-test.json:/etc/mender/mender-connect.conf`,
    'mendersoftware/mender-client-docker-addons:master'
  ];
  console.log(`starting with: ${token}`);
  console.log(`starting using: docker ${args.join(' ')}`);
  let child = spawn('docker', args);
  child.on('error', err => console.error(`${err}`));
  child.on('message', err => console.error(`${err}`));
  child.on('spawn', err => console.error(`${err}`));
  // child.stdout.on('data', data => {
  //   console.log(`stdout docker: ${data}`);
  // });
  child.stderr.on('data', data => {
    console.error(`stderr docker: ${data}`);
  });
  child.on('close', code => {
    console.log(`child process exited with code ${code}`);
  });
  return Promise.resolve();
};

export const setupPage = async (environment: string, context: BrowserContext, page: Page, baseUrl: string) => {
  let cookies = [];
  if (environment === 'staging') {
    try {
      const token = fs.readFileSync('token.json', 'utf8');
      cookies.push({ name: 'tenantToken', value: token, path: '/', domain: baseUrl });
    } catch (error) {
      console.log('no token.json found - moving on...');
    }
  }
  await context.addCookies(cookies);
  page = await context.newPage();
  return page;
};

export const login = async (username: string, password: string, baseUrl: string, context: BrowserContext, failOnStatusCode = true) => {
  const request = await axios({
    url: `${baseUrl}api/management/v1/useradm/auth/login`,
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`,
      'Content-Type': 'application/json'
    },
    httpsAgent: new https.Agent({
      rejectUnauthorized: false
    })
  });

  if (failOnStatusCode && request.status !== 200) {
    throw 'oh no';
  }

  const token = request.data;
  const userId = jwtDecode(token).sub;
  const domain = baseUrlToDomain(baseUrl);
  context.addCookies([
    { name: 'JWT', value: token, path: '/', domain },
    { name: `${userId}-onboarded`, value: 'true', path: '/', domain },
    { name: 'cookieconsent_status', value: 'allow', path: '/', domain }
  ]);
  return context;
};

export const tenantTokenRetrieval = async (baseUrl: string, context: BrowserContext, page: Page) => {
  await page.goto(`${baseUrl}ui/#/settings/organization-and-billing`);
  await page.waitForSelector('.tenant-token-text');
  const token = await page.$eval('.tenant-token-text', el => el.textContent);
  console.log(token);
  const domain = baseUrlToDomain(baseUrl);
  context.addCookies([{ name: 'tenantToken', value: token, path: '/', domain }]);
  return token;
};

let previousSecret;
export const generateOtp = async (otpSecret?) => {
  let filesecret;
  try {
    filesecret = fs.readFileSync('secret.txt', 'utf8');
    console.log(filesecret);
  } catch (error) {
    console.log('no secret.txt found - moving on...');
  }
  previousSecret = otpSecret ?? previousSecret ?? filesecret;
  const secret = previousSecret;
  if (!secret) {
    throw new Error('No secret has been provided.');
  }
  fs.writeFileSync('secret.txt', secret);
  console.log(`2fa secret: ${secret}`);
  return authenticator.generate(secret);
};

const protocol = 'https://';
export const baseUrlToDomain = (baseUrl: string) => baseUrl.substring(baseUrl.indexOf(protocol) + protocol.length, baseUrl.length - 1);

export const compareImages = (expectedPath, actualPath, options = { threshold: 0.1, usePercentage: true }) => {
  const { threshold, usePercentage } = options;
  if (!fs.existsSync(expectedPath)) {
    fs.copyFileSync(actualPath, expectedPath);
  }
  const img1 = PNG.sync.read(fs.readFileSync(actualPath));
  const img2 = PNG.sync.read(fs.readFileSync(expectedPath));
  const { width, height } = img1;
  const diff = new PNG({ width, height });
  const numDiffPixels = pixelmatch(img1.data, img2.data, diff.data, width, height, options);
  const diffPath = path.join(__dirname, '..', 'test-results', 'diffs');
  if (!fs.existsSync(diffPath)) {
    fs.mkdirSync(diffPath);
  }
  fs.writeFileSync(path.join(diffPath, 'diff.png'), PNG.sync.write(diff));
  const pass = usePercentage ? (numDiffPixels / (width * height)) * 100 < threshold : numDiffPixels < threshold;
  return { pass, numDiffPixels };
};
