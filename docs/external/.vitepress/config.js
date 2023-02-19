import {version} from '../../../package.json';
export default {
  title: 'CookieNerds GingerSnap',
  description: 'A networking library with strong data handling and manipulation support',
  cleanUrls: true,
  outDir: '../../public',
  base: '/gingersnap/',
  lastUpdated: true,
  themeConfig: {
    siteTitle: 'GingerSnap',
    socialLinks: [
      {
        icon: {
          svg: `
        <svg width="25" height="24" viewBox="0 0 25 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path class="tanuki-shape tanuki" d="m24.507 9.5-.034-.09L21.082.562a.896.896 0 0 0-1.694.091l-2.29 7.01H7.825L5.535.653a.898.898 0 0 0-1.694-.09L.451 9.411.416 9.5a6.297 6.297 0 0 0 2.09 7.278l.012.01.03.022 5.16 3.867 2.56 1.935 1.554 1.176a1.051 1.051 0 0 0 1.268 0l1.555-1.176 2.56-1.935 5.197-3.89.014-.01A6.297 6.297 0 0 0 24.507 9.5Z" fill="#E24329"></path>
          <path class="tanuki-shape right-cheek" d="m24.507 9.5-.034-.09a11.44 11.44 0 0 0-4.56 2.051l-7.447 5.632 4.742 3.584 5.197-3.89.014-.01A6.297 6.297 0 0 0 24.507 9.5Z" fill="#FC6D26"></path>
          <path class="tanuki-shape chin" d="m7.707 20.677 2.56 1.935 1.555 1.176a1.051 1.051 0 0 0 1.268 0l1.555-1.176 2.56-1.935-4.743-3.584-4.755 3.584Z" fill="#FCA326"></path>
          <path class="tanuki-shape left-cheek" d="M5.01 11.461a11.43 11.43 0 0 0-4.56-2.05L.416 9.5a6.297 6.297 0 0 0 2.09 7.278l.012.01.03.022 5.16 3.867 4.745-3.584-7.444-5.632Z" fill="#FC6D26"></path>
        </svg>
        `
        },
        link: 'https://gitlab.com/cookienerd-frameworks/gingersnap'
      }
    ],
    editLink: {
      pattern: 'https://gitlab.com/cookienerd-frameworks/gingersnap/-/edit/main/docs/external/:path',
      text: 'Edit this page on Gitlab'
    },
    footer: {
      copyright: 'Copyright © CookieNerds LLC 2020-present'
    },
    nav: [
      { text: 'Guide', link: '/' },
      { text: 'Internal Docs', link: 'https://cookienerd-frameworks.gitlab.io/gingersnap/internal/index.html' },
      {
        text: version,
        items: [
          { text: version, link: 'https://gitlab.com/cookienerds-area/npm-repository/-/packages/12607033' },
          { text: 'ChangeLog', link: 'https://gitlab.com/cookienerd-frameworks/gingersnap/-/blob/main/CHANGELOG.md' },
        ]
      }
    ],
    sidebar: [
      {
        text: 'Introduction',
        collapsed: false,
        items: [
          {text: 'What is GingerSnap?', link: '/introduction/what-is-gingersnap'},
          {text: 'Getting Started', link: '/introduction/getting-started'},
        ]
      },
      {
        text: 'Data Modelling',
        collapsed: false,
        items: [
          {text: 'Creating Models', link: '/data-model/model'},
          {text: 'Data Conversion', link: '/data-model/conversion'},
        ]
      },
      {
        text: 'Networking',
        collapsed: false,
        items: [
          {text: 'Futures', link: '/networking/futures'},
          {text: 'Streams', link: '/networking/streams'},
          {text: 'Managing HTTP Requests', link: '/networking/network-service'},
          {text: 'WebSockets', link: '/networking/websockets'},
        ]
      },
      {
        text: 'Synchronization',
        collapsed: true,
        items: [
          {text: 'Future Event', link: '/synchronization/future-event'},
          {text: 'Lock', link: '/synchronization/lock'},
        ]
      },
      {
        text: 'Data Structures',
        collapsed: true,
        items: [
          {
            text: 'Arrays',
            collapsed: true,
            items: [
              {text: 'Cyclical List', link: '/data-structures/arrays/cyclical-list'},
              {text: 'Stack', link: '/data-structures/arrays/stack'},
            ]
          },
          {
            text: 'Objects',
            collapsed: true,
            items: [
              {text: 'Cyclical Object', link: '/data-structures/objects/cyclical-object'},
              {text: 'Timeable Object', link: '/data-structures/objects/timeable-object'},
              {text: 'Waitable Object', link: '/data-structures/objects/waitable-object'},
              {text: 'Watchable Object', link: '/data-structures/objects/watchable-object'},
              {
                text: 'Queues',
                collapsed: true,
                items: [
                  {text: 'Simple Queue', link: '/data-structures/queues/simple-queue'},
                  {text: 'Standard Queue', link: '/data-structures/queues/standard-queue'},
                  {text: 'Buffer', link: '/data-structures/queues/buffer'},
                ]
              }
            ]
          }
        ]
      }
    ]
  }
}
