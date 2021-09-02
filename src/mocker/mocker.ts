import { currentTime, isNodejs } from '../common/utils';
import { HTTPStatusCodes } from '../config';
import { Method, MockConfigData, MockItemExt, RequestInfo } from '../types';
import MockItem from './mock-item';

export default class Mocker {
  private static instance: Mocker;
  private mockConfigData: MockConfigData;
  private disabled: boolean = false;
  private log: boolean = false;

  constructor() {
    if (Mocker.instance) {
      return Mocker.instance;
    }
    Mocker.instance = this;
    this.log = !isNodejs();
    this.mockConfigData = {};
    this.groupLog([['[http-request-mock] is %cloaded.', 'color:inherit;font-weight:bold;']]);
  }

  static getInstance() {
    return new Mocker();
  }

  /**
   * Set global mock data configuration.
   * @param {object} mockConfigData
   */
  public setMockData(mockConfigData: MockConfigData) {
    for(let key in mockConfigData) {
      this.mock(mockConfigData[key]);
    }
    return this;
  }

  /**
   * Add an mock item to global mock data configuration.
   * @param {string} key
   * @param {any} val
   */
  private addMockItem(key: string, val: MockItem) {
    this.mockConfigData[key] = val;
    return this;
  }

  /**
   * Reset global mock data configuration.
   * @param {string} key
   * @param {any} val
   */
  public reset() {
    this.setMockData({});
    return this;
  }

  /**
   * Enable mock function temporarily.
   */
  public enable() {
    this.disabled = false;
    this.groupLog([['[http-request-mock] is %cenabled.', 'color:green;font-weight:bold;']]);
    return this;
  }

  /**
   * Disable mock function temporarily.
   */
  public disable() {
    this.disabled = true;
    this.groupLog([['[http-request-mock] is %cdisabled.', 'color:red;font-weight:bold;']]);
    return this;
  }

  /**
   * Disable mock function temporarily.
   */
  public disableLog() {
    this.log = false;
    return this;
  }

  /**
   * Disable mock function temporarily.
   */
  public enableLog() {
    this.log = true;
    return this;
  }

  /**
   * Check specified mock item & add it to global mock data configuration.
   * @param {MockItem} mockItem
   * @returns false | MockItem
   */
  public mock(mockItemInfo: MockItem) {
    const mockItem = new MockItem(mockItemInfo);
    if (!mockItem.key) return false;

    this.addMockItem(mockItem.key, mockItem);
    return mockItem;
  }

  /**
   * Make a mock item that matches an HTTP GET request.
   * @param {RegExp | String} url
   * @param {any} body
   * @param {MockItemExt} opts {
   *    @param {number} delay
   *    @param {number} status
   *    @param {object} header
   *    @param {number} times
   * }
   */
  public get(url: RegExp | String, body: any, opts: MockItemExt = {
    delay: 0,
    status: 200,
    times: Infinity,
    header: {}
  }) {
    const { delay, status, times, header } = opts;
    this.mock(<MockItem>{ url, method: 'get', body, delay, status, header, times });
    return this;
  }

  /**
   * Make a mock item that matches an HTTP POST request.
   * @param {RegExp | String} url
   * @param {any} body
   * @param {MockItemExt} opts {
   *    @param {number} delay
   *    @param {number} status
   *    @param {object} header
   *    @param {number} times
   * }
   */
  public post(url: RegExp | String, body: any, opts: MockItemExt = {
    delay: 0,
    status: 200,
    times: Infinity,
    header: {}
  }) {
    const { delay, status, times, header } = opts;
    this.mock(<MockItem>{ url, method: 'post', body, delay, status, header, times });
    return this;
  }

  /**
   * Make a mock item that matches an HTTP PUT request.
   * @param {RegExp | String} url
   * @param {any} body
   * @param {MockItemExt} opts {
   *    @param {number} delay
   *    @param {number} status
   *    @param {object} header
   *    @param {number} times
   * }
   */
  public put(url: RegExp | String, body: any, opts: MockItemExt = {
    delay: 0,
    status: 200,
    times: Infinity,
    header: {}
  }) {
    const { delay, status, times, header } = opts;
    this.mock(<MockItem>{ url, method: 'put', body, delay, status, header, times });
    return this;
  }

  /**
   * Make a mock item that matches an HTTP PATCH request.
   * @param {RegExp | String} url
   * @param {any} body
   * @param {MockItemExt} opts {
   *    @param {number} delay
   *    @param {number} status
   *    @param {object} header
   *    @param {number} times
   * }
   */
  public patch(url: RegExp | String, body: any, opts: MockItemExt = {
    delay: 0,
    status: 200,
    times: Infinity,
    header: {}
  }) {
    const { delay, status, times, header } = opts;
    this.mock(<MockItem>{ url, method: 'patch', body, delay, status, header, times });
    return this;
  }

  /**
   * Make a mock item that matches an HTTP DELETE request.
   * @param {RegExp | String} url
   * @param {any} body
   * @param {MockItemExt} opts {
   *    @param {number} delay
   *    @param {number} status
   *    @param {object} header
   *    @param {number} times
   * }
   */
  public delete(url: RegExp | String, body: any, opts: MockItemExt = {
    delay: 0,
    status: 200,
    times: Infinity,
    header: {}
  }) {
    const { delay, status, times, header } = opts;
    this.mock(<MockItem>{ url, method: 'delete', body, delay, status, header, times });
    return this;
  }

  /**
   * https://developer.mozilla.org/en-US/docs/Web/HTTP/Methods/HEAD
   * Warning: A response to a HEAD method should not have a body.
   * If it has one anyway, that body must be ignored: any representation
   * headers that might describe the erroneous body are instead assumed
   * to describe the response which a similar GET request would have received.
   *
   * Make a mock item that matches an HTTP HEAD request.
   * @param {RegExp | String} url
   * @param {MockItemExt} opts {
   *    @param {number} delay
   *    @param {number} status
   *    @param {object} header
   *    @param {number} times
   * }
   */
  public head(url: RegExp | String, opts: MockItemExt = {
    delay: 0,
    status: 200,
    times: Infinity,
    header: {}
  }) {
    const { delay, status, times, header } = opts;
    this.mock(<MockItem>{ url, method: 'head', body: '', delay, status, header, times });
    return this;
  }

  /**
   * Make a mock item that matches an HTTP GET, POST, PUT, PATCH, DELETE or HEAD request.
   * @param {RegExp | String} url
   * @param {any} body
   * @param {MockItemExt} opts {
   *    @param {number} delay
   *    @param {number} status
   *    @param {object} header
   *    @param {number} times
   * }
   */
  public any(url: RegExp | String, body: any, opts: MockItemExt = {
    delay: 0,
    status: 200,
    times: Infinity,
    header: {}
  }) {
    const { delay, status, times, header } = opts;
    this.mock(<MockItem>{ url, method: 'any', body, delay, status, header, times });
    return this;
  }

  /**
   * Check whether the specified request url matchs a defined mock item.
   * If a match were found, return mock meta information, otherwise a null is returned.
   * @param {string} reqUrl
   * @param {string} reqMethod
   * @return null | MockItem
   */
  public matchMockItem(reqUrl: string, reqMethod: Method | undefined): MockItem | null {
    if (this.disabled) {
      return null;
    }

    const requestMethod = reqMethod || 'get';

    for(let key in this.mockConfigData) {
      try {
        const info = this.mockConfigData[key];
        if (info.disable === 'yes' || (typeof info.times !== 'undefined' && info.times <= 0)) {
          continue;
        }

        const method = `${info.method}`.toLowerCase();
        if (method !== 'any' && method !== `${requestMethod}`.toLowerCase()) {
          continue;
        }

        if ((info.url instanceof RegExp) && info.url.test(reqUrl)) {
          return info;
        }

        if (reqUrl.indexOf(info.url as string) !== -1) {
          return info;
        }
      } catch(e) {}
    }
    return null;
  }

  public groupLog(logs: any[]) {
    if (!this.log) return;
    if (typeof console.groupCollapsed !== 'function') return;
    if (typeof console.groupEnd !== 'function') return;

    if (Array.isArray(logs[0])) {
      console.groupCollapsed(...logs[0]);
    } else {
      console.groupCollapsed(logs[0])
    }
    for(let i = 1; i < logs.length; i++) {
      if (Array.isArray(logs[i])) {
        console.log(...logs[i]);
      } else {
        console.log(logs[i])
      }
    }
    console.groupEnd()
  }

  public sendResponseLog(spent: number, body: any, requestInfo: RequestInfo, mockItem: MockItem) {
    const logs = [
      [
        '[http-request-mock] %s %s %s (%c%s%c)',
        `${currentTime()}`,
        requestInfo.method,
        requestInfo.url,

        ('color:' + (mockItem.status < 300 ? 'green' : 'red')),
        mockItem.status,
        'color:inherit',
      ],
      ['Request: ', requestInfo],
      ['Response: ', {
        body,
        spent,
        headers: {...mockItem.header, 'x-powered-by': 'http-request-mock'},
        status: mockItem.status,
        statusText: HTTPStatusCodes[mockItem.status] || ''
      }],
      ['MockItem: ', mockItem]
    ];
    if (isNodejs()) { // less information for nodejs
      const { url, method, delay, times, status, disable } = mockItem;
      logs[3][1] = { url, method, delay, times, status, disable } as any;
    }
    this.groupLog(logs);
  }
}
