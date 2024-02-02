import test from 'node:test'
import assert from 'node:assert/strict'

import { formatErrorMessage } from './formatErrorMessage.js'

test('formatErrorMessage should strip colors', async (_t) => {
  try {
    throw '\u001B[0m\u001B[4m\u001B[42m\u001B[31mfoo\u001B[39m\u001B[49m\u001B[24mfoo\u001B[0m'
  } catch (err) {
    assert(formatErrorMessage(err) === 'foofoo')
  }
})

test('formatErrorMessage should truncate length', async (_t) => {
  try {
    throw 'a'.repeat(200)
  } catch (err) {
    assert(formatErrorMessage(err) === 'a'.repeat(100) + '...')
  }
})

test('formatErrorMessage should strip block formatting', async (_t) => {
  const actualErrorMessage = `
      browserType.launch:
    ╔════════════════════════════════════════════════════════════════════════════════════════════════╗
    ║ Looks like you launched a headed browser without having a XServer running.                     ║
    ║ Set either 'headless: true' or use 'xvfb-run <your-playwright-app>' before running Playwright. ║
    ║                                                                                                ║
    ║ <3 Playwright Team                                                                             ║
    ╚════════════════════════════════════════════════════════════════════════════════════════════════╝
    =========================== logs ===========================
    <launching> /root/.cache/ms-playwright/chromium-1084/chrome-linux/chrome --disable-field-trial-config --disable-background-networking --enable-features=NetworkService,NetworkServiceInProcess --disable-background-timer-throttling --disable-backgrounding-occluded-windows --disable-back-forward-cache --disable-breakpad --disable-client-side-phishing-detection --disable-component-extensions-with-background-pages --disable-component-update --no-default-browser-check --disable-default-apps --disable-dev-shm-usage --disable-extensions --disable-features=ImprovedCookieControls,LazyFrameLoading,GlobalMediaControls,DestroyProfileOnBrowserClose,MediaRouter,DialMediaRouteProvider,AcceptCHFrame,AutoExpandDetailsElement,CertificateTransparencyComponentUpdater,AvoidUnnecessaryBeforeUnloadCheckSync,Translate --allow-pre-commit-input --disable-hang-monitor --disable-ipc-flooding-protection --disable-popup-blocking --disable-prompt-on-repost --disable-renderer-backgrounding --force-color-profile=srgb --metrics-recording-only --no-first-run --enable-automation --password-store=basic --use-mock-keychain --no-service-autorun --export-tagged-pdf --disable-search-engine-choice-screen --no-sandbox --user-data-dir=/tmp/playwright_chromiumdev_profile-V405Mb --remote-debugging-pipe --no-startup-window
    <launched> pid=2188
    [pid=2188][err] [2188:2202:0202/222837.079996:ERROR:bus.cc(407)] Failed to connect to the bus: Failed to connect to socket /run/dbus/system_bus_socket: No such file or directory
    [pid=2188][err] [2188:2188:0202/222837.088783:ERROR:ozone_platform_x11.cc(239)] Missing X server or $DISPLAY
    [pid=2188][err] [2188:2188:0202/222837.088827:ERROR:env.cc(255)] The platform failed to initialize.  Exiting.
    ============================================================).
  `
  try {
    throw actualErrorMessage
  } catch (err) {
    assert(formatErrorMessage(err) === 'browserType.launch: Looks like you launched a headed browser without having a XServer running. Set e...')
  }
})

test('formatErrorMessage handles arbitrary object', async (_t) => {
  try {
    throw NaN
  } catch (err) {
    formatErrorMessage(err)
  }
})

test('formatErrorMessage handles string', async (_t) => {
  try {
    throw 'hi'
  } catch (err) {
    assert(formatErrorMessage(err) === 'hi')
  }
})

test('formatErrorMessage handles exception', async (_t) => {
  try {
    throw new Error('hi')
  } catch (err) {
    assert(formatErrorMessage(err) === 'hi')
  }
})
