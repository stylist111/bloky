
/**
 * The EventDispatcher class allows users to listen to
 * certain events that are emitted.
 * @hideconstructor
 * @param {function} initializer
 * @param {function} [finalizer]
 */
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

  /**
   * Attaches a listener function to an event defined by our api.
   * @param {function} listener The user defined function that will be called
   *                            once the specified event is emitted
   */
  addListener(listener)
  {
    if (!this._initialized)
    {
      this._initialize();
      this._initialized = true;
    }

    this._listeners.add(listener);
  }

  /**
   * Removes the added function from an api event.
   * The listener will no longer be called by the event.
   * @param {function} listener The user defined function to be removed.
   */
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
