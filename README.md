![Logo](admin/hid.png)
### ioBroker.hid

Adapter for HID devices e.g. Apple Remote

#### Info
Completly redesigned 

#### Installation
Execute the following command in the iobroker root directory (e.g. in /opt/iobroker)
```
npm install iobroker.hid 
```

####States

There are two state groups, raw and key. the key group will only be fired, is a mapping is found.

Only one of the states xxx.double, xxx.single and xxx.long will change on an event.
The state xxx.dsl gets the results .double, single or long.
Action indicates down, up or repeat.

#### Mappings
Add or edit the mapping section in the io-package.json file to see the names of the key codes. 
This is not necessary, the raw data states will be created anyway. 
```
  "mappings": {
    "26017F2A55": "AllLightsOn-(AM)",
    "26017F1867": "AllLightsOff-(Memory)",
    "26857A21DE": "OK",
    "26857A55AA": "ESC"
  },
```


#### Requirements

The node-hid module does not work on Windows 10 until you make a smal change to the node-hid project.
After installation of iobroker.hid edit:
```
<path to iobroker>/node_modules/iobroker.hid/node_modules/node-hid/hidapi/windows/hid.c
```
Find:
```
open_device
```
Change the 2nd and 3rd parameter of the function call "CreateFileA":
```
static HANDLE open_device(const char *path, BOOL enumerate)
{
    ... 
      
	handle = CreateFileA(path,
		//desired_access,                    // original line
		GENERIC_WRITE | GENERIC_READ,        // replaced line
		//share_mode,                        // original line
		FILE_SHARE_READ | FILE_SHARE_WRITE,  // replaced line
		NULL,
		OPEN_EXISTING,
		FILE_FLAG_OVERLAPPED,/*FILE_ATTRIBUTE_NORMAL,*/
		0);

	...	
}
```
To rebuild the node-hid module, change to the irectory:
```
cd <path to iobroker>/node_modules/iobroker.hid/node_modules/node-hid
```
execute:                              
```
npm install --build-from-source 
```
Restart the iobroker.hid module...

### License
The MIT License (MIT)

Copyright (c) 2016 soef <soef@gmx.net>

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
