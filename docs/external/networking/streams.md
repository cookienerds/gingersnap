# Streams - Process data in chain

A Stream represents an eventual flow of data from 1 or more asynchronous operations. Streams are useful for processing
data in stages

```ts
import { Stream } from '@cookienerds/gingersnap/utils/stream';
import { ExecutorState } from './state'

let userId = 0;
const postStream = new Stream((signal) => {
  userId++;
  return fetch(`https://jsonplaceholder.typicode.com/posts?userId=${userId}`, { signal })
    .then(resp => resp.json())
    .then(posts => {
      if (posts.length === 0) {
        // stream should end now as there is no more data
        return new ExecutorState(true);
      }
      return posts;
    })
});

const getPostsByUser = async () => {
  for await (let posts of postStream) {
    console.log(`User ${userId} made posts`, posts);
  }
}
getPostsByUser();
```

### Taking few results

```ts
import { Stream } from '@cookienerds/gingersnap/utils/stream';
import { ExecutorState } from './state'

let userId = 0;
const postStream = new Stream((signal) => {
  userId++;
  return fetch(`https://jsonplaceholder.typicode.com/posts?userId=${userId}`, { signal })
    .then(resp => resp.json())
    .then(posts => {
      if (posts.length === 0) {
        // stream should end now as there is no more data
        return new ExecutorState(true);
      }
      return posts;
    })
});

const getPostsByUser = async () => {
  console.log('Retrieving posts for the first 10 users');
  for await (let posts of postStream.take(10)) {
    console.log(`User ${userId} made posts`, posts);
  }
}
getPostsByUser();
```

### Flatten results
```ts
import { Stream } from '@cookienerds/gingersnap/utils/stream';
import { ExecutorState } from './state'

let userId = 0;
const postStream = new Stream((signal) => {
  userId++;
  return fetch(`https://jsonplaceholder.typicode.com/posts?userId=${userId}`, { signal })
    .then(resp => resp.json())
    .then(posts => {
      if (posts.length === 0) {
        // stream should end now as there is no more data
        return new ExecutorState(true);
      }
      return posts;
    })
});

const getPostsByUser = async () => {
  console.log('Retrieving posts for the first user');
  for await (let post of postStream.take(1).flatten()) {
    console.log(`User 1 made post`, post);
  }
}
getPostsByUser();
```

### Skipping results
```ts
import { Stream } from '@cookienerds/gingersnap/utils/stream';
import { ExecutorState } from './state'

let userId = 0;
const postStream = new Stream((signal) => {
  userId++;
  return fetch(`https://jsonplaceholder.typicode.com/posts?userId=${userId}`, { signal })
    .then(resp => resp.json())
    .then(posts => {
      if (posts.length === 0) {
        // stream should end now as there is no more data
        return new ExecutorState(true);
      }
      return posts;
    })
});

const getPostsByUser = async () => {
  console.log('Retrieving posts for user 6 to 10');
  for await (let post of postStream.skip(5).take(5).flatten()) {
    console.log(`User ${userId} made post`, post);
  }
}
getPostsByUser();
```

### Filtering results
```ts
import { Stream } from '@cookienerds/gingersnap/utils/stream';
import { ExecutorState } from './state'

let userId = 0;
const postStream = new Stream((signal) => {
  userId++;
  return fetch(`https://jsonplaceholder.typicode.com/posts?userId=${userId}`, { signal })
    .then(resp => resp.json())
    .then(posts => {
      if (posts.length === 0) {
        // stream should end now as there is no more data
        return new ExecutorState(true);
      }
      return posts;
    })
});

const getPostsByUser = async () => {
  console.log('Retrieving posts with body containing text "error" for user 6 to 10');
  for await (let post of postStream.skip(5).flatten().filter(post => post.body.includes('error'))) {
    console.log(`User ${userId} made post`, post);
  }
}
getPostsByUser();
```


### Transforming results
```ts
import { Stream } from '@cookienerds/gingersnap/utils/stream';
import { ExecutorState } from './state'

let userId = 0;
const postStream = new Stream((signal) => {
  userId++;
  return fetch(`https://jsonplaceholder.typicode.com/posts?userId=${userId}`, { signal })
    .then(resp => resp.json())
    .then(posts => {
      if (posts.length === 0) {
        // stream should end now as there is no more data
        return new ExecutorState(true);
      }
      return posts;
    })
});

const getPostsByUser = async () => {
  console.log('Retrieving posts for user 6 to 10');
  for await (let message of postStream.skip(5).flatten().map(post => `User - ${post.userId}\nTitle - ${post.title}\nBody - ${post.body}`)) {
    console.log(message);
  }
}
getPostsByUser();
```

### Chunking results
```ts
import { Stream } from '@cookienerds/gingersnap/utils/stream';
import { ExecutorState } from './state'

let userId = 0;
const postStream = new Stream((signal) => {
  userId++;
  return fetch(`https://jsonplaceholder.typicode.com/posts?userId=${userId}`, { signal })
    .then(resp => resp.json())
    .then(posts => {
      if (posts.length === 0) {
        // stream should end now as there is no more data
        return new ExecutorState(true);
      }
      return posts;
    })
});

const getPostsByUser = async () => {
  console.log('Retrieving a list of 5 messages at a time');
  for await (let groupedMessages of postStream.flatten().map(post => `User - ${post.userId}\nTitle - ${post.title}\nBody - ${post.body}`).chunk(5)) {
    console.log(groupedMessages.join('\n'));
  }
}
getPostsByUser();
```


### throttling results
```ts
import { Stream } from '@cookienerds/gingersnap/utils/stream';
import { ExecutorState } from './state'

let userId = 0;
const postStream = new Stream((signal) => {
  userId++;
  return fetch(`https://jsonplaceholder.typicode.com/posts?userId=${userId}`, { signal })
    .then(resp => resp.json())
    .then(posts => {
      if (posts.length === 0) {
        // stream should end now as there is no more data
        return new ExecutorState(true);
      }
      return posts;
    })
});

const getPostsByUser = async () => {
  console.log('Waiting 5 seconds in between calls to fetch posts by userId');
  for await (let message of postStream.throttleBy({seconds: 5}).flatten().map(post => `User - ${post.userId}\nTitle - ${post.title}\nBody - ${post.body}`)) {
    console.log(message);
  }
}
getPostsByUser();
```

### Executing once
```ts
import { Stream } from '@cookienerds/gingersnap/utils/stream';
import { ExecutorState } from './state'

let userId = 0;
const postStream = new Stream((signal) => {
  userId++;
  return fetch(`https://jsonplaceholder.typicode.com/posts?userId=${userId}`, { signal })
    .then(resp => resp.json())
    .then(posts => {
      if (posts.length === 0) {
        // stream should end now as there is no more data
        return new ExecutorState(true);
      }
      return posts;
    })
});

const getPostsByUser = async () => {
  console.log('Only retrieving user 1 posts');
  for await (let message of postStream.once().flatten().map(post => `User - ${post.userId}\nTitle - ${post.title}\nBody - ${post.body}`)) {
    console.log(message);
  }
}
getPostsByUser();
```

### Executing once
```ts
import { Stream } from '@cookienerds/gingersnap/utils/stream';
import { ExecutorState } from './state'

let userId = 0;
const postStream = new Stream((signal) => {
  userId++;
  return fetch(`https://jsonplaceholder.typicode.com/posts?userId=${userId}`, { signal })
    .then(resp => resp.json())
    .then(posts => {
      if (posts.length === 0) {
        // stream should end now as there is no more data
        return new ExecutorState(true);
      }
      return posts;
    })
});

const getPostsByUser = async () => {
  console.log('Only retrieving user 1 posts');
  for await (let message of postStream.once().flatten().map(post => `User - ${post.userId}\nTitle - ${post.title}\nBody - ${post.body}`)) {
    console.log(message);
  }
}
getPostsByUser();
```

### Executing once
```ts
import { Stream } from '@cookienerds/gingersnap/utils/stream';
import { ExecutorState } from './state'

let userId = 0;
const postStream = new Stream((signal) => {
  userId++;
  return fetch(`https://jsonplaceholder.typicode.com/posts?userId=${userId}`, { signal })
    .then(resp => resp.json())
    .then(posts => {
      if (posts.length === 0) {
        // stream should end now as there is no more data
        return new ExecutorState(true);
      }
      return posts;
    })
});

const getPostsByUser = async () => {
  console.log('Only retrieving user 1 posts');
  const posts = await postStream.execute();
}
getPostsByUser();
```

### Futures to Stream
```ts
import { Stream } from '@cookienerds/gingersnap/utils/stream';
import { ExecutorState } from './state'

let userId = 0;
const postStream = Future.of(fetch('https://jsonplaceholder.typicode.com/posts')).stream
  .map(resp => resp.json())
  .flatten();

const getPostsByUser = async () => {
  console.log('Only retrieving user 1 posts');
  const posts = await postStream.execute();
}
getPostsByUser();
```
