import {assert} from '/lib/base';

const registry = {};
let storage = localStorage;

const mockPersistenceLayer = (replacement) => {
  Tracker.flush();
  storage = replacement;
  Object.keys(registry).map((key) => registry[key]._load());
}

class PersistentDict {
  constructor(name, onload) {
    this._name = name;
    this._onload = onload;
    this._cache = {};
    this._dirty = {};
    this._sentinel = new ReactiveDict();
    this._load();
    Meteor.autorun(() => this._save());
    assert(!registry[name]);
    registry[name] = this;
  }
  clear() {
    Object.keys(this._cache).map(this.delete.bind(this));
  }
  delete(key) {
    delete this._cache[key];
    this._dirty[key] = true;
    this._sentinel.set(key, !this._sentinel.get(key));
  }
  depend() {
    this._sentinel.allDeps.depend();
  }
  get(key) {
    this._sentinel.get(key);
    return this._cache[key];
  }
  set(key, value) {
    this._cache[key] = value;
    this._dirty[key] = true;
    this._sentinel.set(key, !this._sentinel.get(key));
  }
  _load() {
    this.clear();
    const prefix = `table.${this._name}.`;
    const ids = Object.keys(storage).filter((id) => id.startsWith(prefix));
    ids.forEach((id) => this.set(
        id.substr(prefix.length), JSON.parse(storage[id])));
    this._onload && this._onload(this._cache);
    this._dirty = {};
  }
  _save() {
    this.depend();
    Meteor.defer(() => {
      Object.keys(this._dirty).forEach((key) => {
        const id = `table.${this._name}.${key}`;
        if (this._cache.hasOwnProperty(key)) {
          storage[id] = JSON.stringify(this._cache[key]);
        } else {
          delete storage[id];
        }
      });
      this._dirty = {};
    });
  }
}

class PersistentVar {
  constructor(name) {
    this._dict = new PersistentDict(name);
  }
  get() {
    return this._dict.get('value');
  }
  set(value) {
    const clear = value === undefined;
    clear ? this._dict.delete('value') : this._dict.set('value', value);
  }
}

export {mockPersistenceLayer, PersistentDict, PersistentVar};
