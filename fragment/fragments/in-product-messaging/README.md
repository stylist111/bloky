# In-product messaging fragment

A fragment that retrieves in-product messaging commands from the remote configuration, evaluates them and provides them to actors that can execute them.

## Host integration

Pass all dependencies to fragment during initialization:

```js
import { start } from "@eyeo-fragments/in-product-messaging/background";

void start(addonInfo);
```

Register an actor to handle any commands with a specific name:

```js
import { setCommandActor } from "@eyeo-fragments/in-product-messaging/background";

setCommandActor(commandName, commandInfo);
```

## Testing

### Unit tests

Unit tests are contained in `src/**/*.spec.ts` files.

```bash
npm test -- --scope @eyeo-fragments/in-product-messaging
```

### Functional tests

Functional / end-to-end tests are handled at the host level.
