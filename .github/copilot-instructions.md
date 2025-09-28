# ioBroker Adapter Development with GitHub Copilot

**Version:** 0.4.0
**Template Source:** https://github.com/DrozmotiX/ioBroker-Copilot-Instructions

This file contains instructions and best practices for GitHub Copilot when working on ioBroker adapter development.

## Project Context

You are working on an ioBroker adapter. ioBroker is an integration platform for the Internet of Things, focused on building smart home and industrial IoT solutions. Adapters are plugins that connect ioBroker to external systems, devices, or services.

**Adapter Name:** hid-community  
**Primary Function:** HID (Human Interface Device) input device integration for ioBroker  
**Key Dependencies:** node-hid library for USB/HID device communication  
**Target Devices:** USB HID devices like keyboards, mice, game controllers, custom hardware buttons, and specialized input devices  
**Configuration Requirements:** Vendor ID, Product ID, device mapping configurations, and keyUp timeout settings

This adapter enables ioBroker to receive input from HID devices, allowing physical buttons, joysticks, keyboards, and other input devices to trigger automation sequences in smart home and IoT environments.

## Testing

### Unit Testing
- Use Jest as the primary testing framework for ioBroker adapters
- Create tests for all adapter main functions and helper methods
- Test error handling scenarios and edge cases
- Mock external API calls and hardware dependencies
- For adapters connecting to APIs/devices not reachable by internet, provide example data files to allow testing of functionality without live connections
- Example test structure:
  ```javascript
  describe('AdapterName', () => {
    let adapter;
    
    beforeEach(() => {
      // Setup test adapter instance
    });
    
    test('should initialize correctly', () => {
      // Test adapter initialization
    });
  });
  ```

### Integration Testing

**IMPORTANT**: Use the official `@iobroker/testing` framework for all integration tests. This is the ONLY correct way to test ioBroker adapters.

**Official Documentation**: https://github.com/ioBroker/testing

#### Framework Structure
Integration tests MUST follow this exact pattern:

```javascript
const path = require('path');
const { tests } = require('@iobroker/testing');

// Define test coordinates or configuration
const TEST_COORDINATES = '52.520008,13.404954'; // Berlin
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

// Use tests.integration() with defineAdditionalTests
tests.integration(path.join(__dirname, '..'), {
    defineAdditionalTests({ suite }) {
        suite('Test adapter with specific configuration', (getHarness) => {
            let harness;

            before(() => {
                harness = getHarness();
            });

            it('should configure and start adapter', function () {
                return new Promise(async (resolve, reject) => {
                    try {
                        harness = getHarness();
                        
                        // Get adapter object using promisified pattern
                        const obj = await new Promise((res, rej) => {
                            harness.objects.getObject('system.adapter.your-adapter.0', (err, o) => {
                                if (err) return rej(err);
                                res(o);
                            });
                        });
                        
                        if (!obj) {
                            return reject(new Error('Adapter object not found'));
                        }

                        // Configure adapter properties
                        Object.assign(obj.native, {
                            position: TEST_COORDINATES,
                            createCurrently: true,
                            createHourly: true,
                            createDaily: true,
                            // Add other configuration as needed
                        });

                        // Set the updated configuration
                        harness.objects.setObject(obj._id, obj);

                        console.log('✅ Step 1: Configuration written, starting adapter...');
                        
                        // Start adapter and wait
                        await harness.startAdapterAndWait();
                        
                        console.log('✅ Step 2: Adapter started');

                        // Wait for adapter to process data
                        const waitMs = 15000;
                        await wait(waitMs);

                        console.log('🔍 Step 3: Checking states after adapter run...');
                        
                        const dataStates = await harness.getAllStatesOf(harness.adapterName);
                        
                        const hasData = Object.keys(dataStates).some(stateId => {
                            return stateId.endsWith('.temperature') || 
                                   stateId.endsWith('.humidity') || 
                                   stateId.endsWith('.condition');
                        });
                        
                        if (hasData) {
                            console.log('✅ SUCCESS: States were created and contain expected data');
                            return resolve(true);
                        } else {
                            console.log('❌ TIMEOUT: No expected states found after waiting');
                            return reject(new Error('No expected data states were created within the timeout period'));
                        }
                        
                    } catch (error) {
                        console.error(`❌ Test failed with error: ${error.message}`);
                        return reject(error);
                    }
                });
            }).timeout(30000);
        });
    }
});
```

#### Critical Integration Testing Patterns

**ALWAYS** follow this pattern for adapter testing to avoid common issues:

1. **Proper Harness Usage**:
   ```javascript
   // Get fresh harness in each test
   harness = getHarness();
   
   // Configure before starting
   await harness.changeAdapterConfig('your-adapter', {
       native: { /* config */ }
   });
   
   // Start and wait for readiness
   await harness.startAdapterAndWait();
   ```

2. **State Verification Pattern**:
   ```javascript
   const states = await harness.getAllStatesOf(harness.adapterName);
   const hasExpectedState = Object.keys(states).some(stateId => 
       stateId.includes('expectedPattern')
   );
   ```

3. **Timeout Management**:
   ```javascript
   // Always provide adequate timeout
   it('test description', function() {
       // test implementation
   }).timeout(60000); // Minimum 30s, prefer 60s+
   ```

#### Common Pitfalls to Avoid
- ❌ Don't use `tests.unit()` for adapter functionality testing
- ❌ Don't mix Jest with `@iobroker/testing` - use only `@iobroker/testing`  
- ❌ Don't test without proper harness configuration
- ❌ Don't assume immediate state availability after adapter start
- ❌ Don't use short timeouts (<30 seconds) for integration tests

#### Example: Complete HID Device Testing

For HID adapters, test device discovery and input handling:

```javascript
tests.integration(path.join(__dirname, '..'), {
    defineAdditionalTests({ suite }) {
        suite('HID Device Integration Tests', (getHarness) => {
            let harness;

            before(() => {
                harness = getHarness();
            });

            it('should detect HID devices and create states', async function () {
                harness = getHarness();
                
                // Configure HID adapter with test device IDs
                await harness.changeAdapterConfig('hid-community', {
                    native: {
                        vendorID: "0x046D",  // Logitech
                        productID: "0xC077", // M105 Mouse
                        createUnknownStates: true,
                        keyUpTimeout: 200
                    }
                });

                await harness.startAdapterAndWait();
                
                // Wait for device discovery
                await new Promise(resolve => setTimeout(resolve, 10000));

                // Check if device states were created
                const states = await harness.getAllStatesOf('hid-community');
                
                expect(Object.keys(states).length).toBeGreaterThan(0);
                expect(states).toHaveProperty('hid-community.0.info.connection');
                
                console.log('✅ HID device states created successfully');
                
            }).timeout(30000);
        });
    }
});
```

## Hardware-Specific Testing

For HID adapters, consider testing patterns for different device scenarios:

### Mock HID Device Testing
```javascript
// Mock node-hid for testing without physical devices
jest.mock('node-hid', () => ({
    devices: jest.fn(() => [
        {
            vendorId: 0x046D,
            productId: 0xC077,
            path: 'test-device-path',
            serialNumber: 'TEST123',
            manufacturer: 'Test Manufacturer',
            product: 'Test HID Device'
        }
    ]),
    HID: jest.fn().mockImplementation(() => ({
        on: jest.fn(),
        close: jest.fn(),
        write: jest.fn()
    }))
}));
```

### Device Configuration Testing
```javascript
describe('HID Device Configuration', () => {
    test('should validate vendor and product IDs', () => {
        const config = {
            vendorID: "046D",
            productID: "C077"
        };
        
        // Test ID parsing and validation
        expect(parseHexId(config.vendorID)).toBe(0x046D);
        expect(parseHexId(config.productID)).toBe(0xC077);
    });
    
    test('should handle device mapping configurations', () => {
        const mappings = {
            "26017F2A55": "AllLightsOn-(AM)",
            "26017F1867": "AllLightsOff-(Memory)"
        };
        
        // Test mapping validation and processing
        expect(Object.keys(mappings)).toHaveLength(2);
        expect(mappings["26017F2A55"]).toBe("AllLightsOn-(AM)");
    });
});
```

## Logging and Debugging

Follow ioBroker logging best practices with appropriate levels:

```javascript
// Use appropriate log levels
this.log.error('Critical errors that stop adapter functionality');
this.log.warn('Important issues that don\'t stop functionality');  
this.log.info('Important status information visible by default');
this.log.debug('Detailed information for troubleshooting');

// Log HID device events appropriately
this.log.info(`HID device connected: ${device.manufacturer} ${device.product}`);
this.log.debug(`Raw HID data received: ${JSON.stringify(data)}`);
this.log.warn(`Unknown HID device data: ${dataHex}`);
```

## Error Handling and Resource Management

Implement proper error handling and cleanup for hardware resources:

```javascript
// Device connection error handling
try {
    const device = new HID.HID(devicePath);
    device.on('data', this.onDeviceData.bind(this));
    device.on('error', this.onDeviceError.bind(this));
} catch (error) {
    this.log.error(`Failed to connect to HID device: ${error.message}`);
    this.setState('info.connection', false, true);
}

// Proper resource cleanup in unload method
async unload(callback) {
  try {
    // Close HID device connections
    if (this.hidDevice) {
      try {
        this.hidDevice.close();
      } catch (e) {
        this.log.warn(`Error closing HID device: ${e.message}`);
      }
      this.hidDevice = null;
    }
    
    // Clear timers
    if (this.connectionTimer) {
      clearTimeout(this.connectionTimer);
      this.connectionTimer = undefined;
    }
    // Close connections, clean up resources
    callback();
  } catch (e) {
    callback();
  }
}
```

## Code Style and Standards

- Follow JavaScript/TypeScript best practices
- Use async/await for asynchronous operations
- Implement proper resource cleanup in `unload()` method
- Use semantic versioning for adapter releases
- Include proper JSDoc comments for public methods

## CI/CD and Testing Integration

### GitHub Actions for API Testing
For adapters with external API dependencies, implement separate CI/CD jobs:

```yaml
# Tests API connectivity with demo credentials (runs separately)
demo-api-tests:
  if: contains(github.event.head_commit.message, '[skip ci]') == false
  
  runs-on: ubuntu-22.04
  
  steps:
    - name: Checkout code
      uses: actions/checkout@v4
      
    - name: Use Node.js 20.x
      uses: actions/setup-node@v4
      with:
        node-version: 20.x
        cache: 'npm'
        
    - name: Install dependencies
      run: npm ci
      
    - name: Run demo API tests
      run: npm run test:integration-demo
```

### CI/CD Best Practices
- Run credential tests separately from main test suite
- Use ubuntu-22.04 for consistency
- Don't make credential tests required for deployment
- Provide clear failure messages for API connectivity issues
- Use appropriate timeouts for external API calls (120+ seconds)

### Package.json Script Integration
Add dedicated script for credential testing:
```json
{
  "scripts": {
    "test:integration-demo": "mocha test/integration-demo --exit"
  }
}
```

### Practical Example: Complete API Testing Implementation
Here's a complete example based on lessons learned from the Discovergy adapter:

#### test/integration-demo.js
```javascript
const path = require("path");
const { tests } = require("@iobroker/testing");

// Helper function to encrypt password using ioBroker's encryption method
async function encryptPassword(harness, password) {
    const systemConfig = await harness.objects.getObjectAsync("system.config");
    
    if (!systemConfig || !systemConfig.native || !systemConfig.native.secret) {
        throw new Error("Could not retrieve system secret for password encryption");
    }
    
    const secret = systemConfig.native.secret;
    let result = '';
    for (let i = 0; i < password.length; ++i) {
        result += String.fromCharCode(secret[i % secret.length].charCodeAt(0) ^ password.charCodeAt(i));
    }
    
    return result;
}

// Run integration tests with demo credentials
tests.integration(path.join(__dirname, ".."), {
    defineAdditionalTests({ suite }) {
        suite("API Testing with Demo Credentials", (getHarness) => {
            let harness;
            
            before(() => {
                harness = getHarness();
            });

            it("Should connect to API and initialize with demo credentials", async () => {
                console.log("Setting up demo credentials...");
                
                if (harness.isAdapterRunning()) {
                    await harness.stopAdapter();
                }
                
                const encryptedPassword = await encryptPassword(harness, "demo_password");
                
                await harness.changeAdapterConfig("your-adapter", {
                    native: {
                        username: "demo@provider.com",
                        password: encryptedPassword,
                        // other config options
                    }
                });

                console.log("Starting adapter with demo credentials...");
                await harness.startAdapter();
                
                // Wait for API calls and initialization
                await new Promise(resolve => setTimeout(resolve, 60000));
                
                const connectionState = await harness.states.getStateAsync("your-adapter.0.info.connection");
                
                if (connectionState && connectionState.val === true) {
                    console.log("✅ SUCCESS: API connection established");
                    return true;
                } else {
                    throw new Error("API Test Failed: Expected API connection to be established with demo credentials. " +
                        "Check logs above for specific API errors (DNS resolution, 401 Unauthorized, network issues, etc.)");
                }
            }).timeout(120000);
        });
    }
});
```

## HID Device Development Patterns

### Device Discovery and Connection
```javascript
// Discover and filter HID devices
const devices = HID.devices();
const filteredDevices = devices.filter(device => {
    const vendorMatch = !this.config.vendorID || 
        parseInt(this.config.vendorID, 16) === device.vendorId;
    const productMatch = !this.config.productID || 
        parseInt(this.config.productID, 16) === device.productId;
    
    return vendorMatch && productMatch;
});

// Connect to discovered devices
for (const deviceInfo of filteredDevices) {
    try {
        const device = new HID.HID(deviceInfo.path);
        this.registerDevice(device, deviceInfo);
    } catch (error) {
        this.log.warn(`Failed to connect to device ${deviceInfo.path}: ${error.message}`);
    }
}
```

### Input Data Processing
```javascript
// Process incoming HID data
onDeviceData(data) {
    const dataHex = data.toString('hex').toUpperCase();
    this.log.debug(`HID data received: ${dataHex}`);
    
    // Check for known mappings
    if (this.mappings[dataHex]) {
        const action = this.mappings[dataHex];
        this.log.info(`HID action triggered: ${action}`);
        this.setState(`buttons.${action}`, true, true);
        
        // Handle keyUp timeout
        setTimeout(() => {
            this.setState(`buttons.${action}`, false, true);
        }, this.config.keyUpTimeout || 200);
    } else if (this.config.createUnknownStates) {
        // Create state for unknown input
        this.createUnknownState(dataHex);
    }
}
```

### Device State Management
```javascript
// Create device-specific states
async createDeviceStates(device, deviceInfo) {
    const deviceId = `${deviceInfo.vendorId.toString(16)}_${deviceInfo.productId.toString(16)}`;
    
    await this.setObjectNotExistsAsync(`devices.${deviceId}`, {
        type: 'channel',
        common: {
            name: `${deviceInfo.manufacturer} ${deviceInfo.product}`,
        },
        native: deviceInfo
    });
    
    await this.setObjectNotExistsAsync(`devices.${deviceId}.connected`, {
        type: 'state',
        common: {
            name: 'Device Connected',
            type: 'boolean',
            role: 'indicator.connected',
            read: true,
            write: false
        },
        native: {}
    });
}
```