export class EventDispatcher
{
  constructor(initializer, finalizer)
  {
    this._listeners = new Set();
    this._initialized = false;

    let dispatch = (...args) =>
    {
      for (let listener of this._listeners)
        listener(...args);
    };

    this._initialize = initializer.bind(null, dispatch);
    this._finalize = finalizer && finalizer.bind(null, dispatch);
  }

  addListener(listener)
  {
    if (!this._initialized)
    {
      this._initialize();
      this._initialized = true;
    }

    this._listeners.add(listener);
  }

  removeListener(listener)
  {
    this._listeners.delete(listener);

    if (this._initialized && this._finalize && this._listeners.size == 0)
    {
      this._finalize();
      this._initialized = false;
    }
  }
}
