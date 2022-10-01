## GingerSnap


## Description
Gingersnap is a library for managing network requests, data serialization/deserialization and data validation all with minimal code


## Installation
To use as an NPM package in a project:
1. Request a token for connection to the CookieNerds NPM Area
2. Create a .npmrc file inside your project and add the following <br />
   @cookienerds:registry=https://gitlab.com/api/v4/projects/31753272/packages/npm/
   //gitlab.com/api/v4/projects/31753272/packages/npm/:_authToken="<my token here>"
3. To install the package, run `npm install @cookienerds/gingersnap`

## Support
For support, please contact <a href="mailto:dev@cookienerds.com">dev@cookienerds.com</a>

## Roadmap
- Support request retry on status 503
- Support request timeout
- Opt out of using an authenticator for a method's request
- Support multiple authenticators, and setting Primary authenticator
- Allow methods to choose authenticator
- Support endpoint polling with subscription methods
- Support offline mode with resume feature once net is back
- Support default response when offline
- Support grouping requests, if one fail cancel all
- Support race requests, the first one that finishes/fails cancel all others and return the response
- Plugin support
- Support for NodeJs
- Push message support via subscribers
- Websocket support via subscribers, and methods for sending messages
- Websocket auth support
- Improved documentation
