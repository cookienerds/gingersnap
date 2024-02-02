# Futures - The reality that was Promised

A Future represents an eventual result of some asynchronous operation. Futures are quite similar to Promises, and can be
awaited as they are **Thenable** objects. However, futures have features that promises are missing.

## Why Choose Futures ?

### Futures allow you to control WHEN asynchronous operation begins
With Promises, you have no control over when they are executed. Futures on the other hand don't action the async 
operation upon creation. They have to be explicitly run by calling the **run** method, which returns a promise, or by 
awaiting the future.
```ts
import { Future } from "@cookienerds/gingersnap/future";

// creating a future does not execute it
const future = new Future<number>((resolve, reject) => {
  resolve(Math.random());
});

// you have to manually trigger the execution of the async operation
future.run().then(result => {
  console.log('Got number ' + result);
});

(async () => {
  
  // Or you can await the future. NOTE this future was already executed. 
  // They can only be executed once
  const result = await future;
  console.log('Got number ' + result);
})();
```

### Futures are cancelable
As shown in the previous example, future objects take a function that has a resolve and reject callback, similar to
promises. However, futures have a third (3rd) argument called **signal**. This is an abort signal, for the future to 
listen when it's cancelled and perform the necessary cancellation operation. If the future does not handle abortion,
the future is force cancelled with calls to resolve and reject having no effect.

```ts
import { Future, FutureCancelled } from "@cookienerds/gingersnap/future";

// creating a future does not execute it
const future = new Future<number>((resolve, reject, signal) => {
  // wait 5 seconds to provide result
  const timer = setTimeout(() => resolve(Math.random()), 5000);
  signal.onabort = () => clearTimeout(timer); // cleanup on cancel
});

const awaitFuture = async () => {
  try {
    const result = await future;
    // never runs
    console.log('Got number ' + result);
  } catch (error: FutureCancelled) {
    // future was cancelled // [!code error]
  }
}
awaitFuture();

// Future is cancelled
future.cancel();
```

### Future state can be checked
Futures have a clean approach to check there state, whereas promises don't

```ts
import { Future } from "@cookienerds/gingersnap/future";

// creating a future does not execute it
const future = new Future<number>((resolve, reject) => {
  resolve(Math.random());
});

// you have to manually trigger the execution of the async operation
future.run().then(result => {
  console.log('Got number ' + result);
});

console.log(`Did the future complete successfully ? `, future.done);
console.log(`Did the future fail ? `, future.failed);
console.log(`Is the future running ? `, future.running);
console.log(`If it failed, the error is `, future.error);
console.log(`If it completed, the result is `, future.result);
```

## Chaining Futures
Futures can be chained using the **thenApply** method. The callback is then provided with a **FutureResult**
object that contains the **value** of the executed future, and the **signal** to handle any cancel event. thenApply by
default modifies the existing future (for faster performance, no object cloning like what is done in Promises), but can
be cloned if 2nd argument of **true** is passed. Given the signal is passed down the chain, we can provide deeply nested 
operations with the ability to listen to cancellation.
```ts
import { Future } from "@cookienerds/gingersnap/future";

(async () => {
  const future1 = new Future<number>((resolve, reject) => {
    // returns random number 1 - 11
    resolve(Math.floor(Math.random() * 10) + 1);
  }).thenApply(result => {
    return fetch(
      `https://jsonplaceholder.typicode.com/posts/${result.value}`, 
      {signal: result.signal}
    )
      .then(resp => resp.json())
  });
  const future2 = future1.thenApply(result => {
    return result.value.userId as number;
  }, true); // <- second argument to clone the future under .thenApply
  const future3 = future2.clone(); // you can also clone the future like this
  
  const result1 = await future1;
  const result2 = await future2;
  const result3 = await future3;
  console.log('Random user is ' + result1);
  console.log('Random userId is ' + result2);
  console.log('Random userId is ' + result3);
})()
```

## Catching Errors and Finally Block
You can catch errors using the **catch** method, similar to Promises.catch as well as adding finally block
```ts
import { Future } from "@cookienerds/gingersnap/future";

(async () => {
  const future = new Future<number>((resolve, reject) => {
    // returns random number 1 - 11
    resolve(Math.floor(Math.random() * 10) + 1);
  }).thenApply(result => {
    return fetch(
      `https://jsonplaceholder.typicode.com/posts/${result.value}`, 
      {signal: result.signal}
    )
      .then(resp => resp.json())
  }).thenApply(result => {
    return result.value.userId as number;
  }).catch((error: any) => { // [!code focus]
    console.log('Received error', error); // [!code focus]
  }).finally(() => { // [!code focus]
    console.log('executed after everthing') // [!code focus]
  }); // [!code focus]
  
  const result = await future;
  console.log('Random userId is ' + result);
})();
```

## Registering external signals
You can add external signals to a future which allows the future to be cancelled from more than one source.
```ts
import { Future } from "@cookienerds/gingersnap/future";

const awaitFuture = async (signal: AbortSignal) => { // [!code focus]
  const future = new Future<number>((resolve, reject) => {
    // returns random number 1 - 11
    resolve(Math.floor(Math.random() * 10) + 1);
  }).thenApply(result => {
    return fetch(
      `https://jsonplaceholder.typicode.com/posts/${result.value}`, 
      {signal: result.signal}
    )
      .then(resp => resp.json())
  }).thenApply(result => {
    return result.value.userId as number;
  }).catch((error: any) => {
    console.log('Received error', error);
  }).registerSignal(signal);// [!code focus]
  //You can remove registered signal via // [!code focus]
  // future.unregisterSignal(signal); // [!code focus]
  
  // if the future takes more than 5 seconds to complete, cancel  // [!code focus]
  const timer = setTimeout(() => future.cancel(), 5000);  // [!code focus]
  const result = await future;  // [!code focus]
  clearTimeout(timer);
  console.log('Random userId is ' + result);
}
const controller = new AbortController();  // [!code focus]
awaitFuture(controller.signal);  // [!code focus]
controller.abort(); // cancelling future from an external signal  // [!code focus]
```

## Sleeping
Futures make's it easier to handle sleeping operations. You can always cancel the sleep using the **cancel** method.

```ts
// from @cookienerds/gingersnap/future
export interface WaitPeriod {
  minutes?: number;
  seconds?: number;
  milliseconds?: number;
  hours?: number;
}
```

```ts
import { Future } from "@cookienerds/gingersnap/future";

// pass the WaitPeriod to the Future or the number of seconds (WaitPeriod | number)
const future = Future.sleep({seconds: 5})
  .thenApply(() => console.log('waited 5 seconds'));

future.run();
```

## Waiting before cancellation
Waiting on a long-running task forever might be an issue for your application, and therefore you may want to cancel 
the operation if it takes too long. Using **Future.waitFor** you can wait for a future to complete within a specified
WaitPeriod, and if it doesn't complete before that time, you cancel the future. **Future.waitFor** also returns a new
future.

```ts
import { Future, FutureCancelled } from "@cookienerds/gingersnap/future";

// Alternative to new Future((resolve, reject, signal) => {..})
const userIdFuture = Future.of((resolve, reject, signal) => {
  fetch('https://jsonplaceholder.typicode.com/posts/1', { signal })
    .then(resp => resolve(resp.json()))
    .catch(reject)
}).thenApply(result => {
  return result.value.userId as number;
});

(async () => {
  try {
    // wait for maximum 5 seconds to get the userId of the first post
    const future = await Future.waitFor(userIdFuture, { seconds: 5 });
  } catch (error) {
    if (error instanceof FutureCancelled) {
      console.log('Future was cancelled. Fetching userId took too long...');
    } else {
      console.error(error);
    }
  }
})()
```

## Scheduling without waiting

You can schedule a future to execute in background, without having to await the future
```ts
import { Future } from "@cookienerds/gingersnap/future";

const userIdFuture = Future.of((resolve, reject, signal) => {
  fetch('https://jsonplaceholder.typicode.com/posts/1', { signal })
    .then(resp => resolve(resp.json()))
    .catch(reject)
}).thenApply(result => {
 console.log(`Got title ${result.value.title}`);
});

// returns reference to the same future. Future is now running in the background. 
// You can still await future or check the future's state
const future = userIdFuture.schedule();
```

## Creating a completed future

You can create a completed future similar to Promise.resolve.
```ts
import { Future } from "@cookienerds/gingersnap/future";

const future = Future.completed(5).thenApply(result => {
  console.log(`Future completed with number ${result.value}`);
});

future.schedule();
```

## Creating a failed future

You can create a failed future similar to Promise.reject.
```ts
import { Future } from "@cookienerds/gingersnap/future";

const future = Future.exceptionally(new Error('something went wrong'));

future.schedule();
console.log(`Future failed? ${future.failed ? 'Yes': 'No'}`);
```

## Converting to Future

You can convert Promises to a future using the **Future.wrap** method
```ts
import { Future } from "@cookienerds/gingersnap/future";

// Future from a promise
const future = Future.wrap(Promise.resolve(5)).thenApply(result => {
  console.log(`Future completed with number ${result.value}`);
});

future.schedule();
```
