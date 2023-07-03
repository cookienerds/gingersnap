import { Stream } from "../../utils";
import { Optional } from "../../utils/optional";
import { Model } from "./model";

/**
 * Abstract class for managing a collection of models of the same type
 * @experimental
 */
export abstract class Collection<T extends Model> {
  /**
   * Persists the given model to the collection. If the model already exists, save the changes rather than create a new
   * record
   * @param model
   * @returns stream of the ID of the given model
   */
  abstract save(model: T): Stream<string>;

  /**
   * Persists the given models to the collection. If any of the models exists, save the changes rather than create a new
   * record
   * @param models
   * @returns stream of the IDs of the given models
   */
  abstract saveAll(models: T[]): Stream<string[]>;

  /**
   * Searches for all models that meets the given criteria
   * @param query search criteria
   * @param options other configurations to apply to lookup
   * @returns stream with list of models
   */
  abstract findAll<K extends {}, V extends {}>(query: K, options?: V): Stream<T[]>;

  /**
   * Searches for the only model that has the given ID
   * @param id ID of the model
   * @param options other configurations to apply to lookup
   * @returns stream with optional model
   *
   * @see Optional
   */
  abstract findById<K extends {}>(id: string, options?: K): Stream<Optional<T>>;

  /**
   * Searches for the first model that matches the given criteria.
   * @param query search criteria
   * @param options other configurations to apply to the lookup
   * @returns stream with optional model
   *
   * @see Optional
   */
  abstract findOne<K extends {}, V extends {}>(query: K, options?: V): Stream<Optional<T>>;

  /**
   * Updates all models that matches the given criteria
   * @param query search criteria
   * @param changes
   * @param options
   * @returns stream with the number of records updated
   */
  abstract updateAll<K extends {}, V extends {}, J extends {}>(query: K, changes: V, options?: J): Stream<number>;

  /**
   * Updates the first model that matches the given criteria
   * @param query search criteria
   * @param changes
   * @param options
   * @returns stream with the number of records updated
   */
  abstract updateOne<K extends {}, V extends {}, J extends {}>(query: K, changes: V, options?: J): Stream<number>;

  /**
   * Updates the model that matches the given criteria
   * @param id model ID
   * @param changes
   * @param options
   * @returns stream with the number of models updated
   */
  abstract updateById<K extends {}, V extends {}>(id: string, changes: K, options?: V): Stream<number>;

  /**
   * Deletes all models that matches the given criteria
   * @param query search criteria
   * @param options
   * @returns stream with no result
   */
  abstract deleteAll<K extends {}, V extends {}>(query: K, options?: V): Stream<void>;

  /**
   *Deletes the first model that matches the given criteria
   * @param query search criteria
   * @param options
   * @returns stream with no result
   */
  abstract deleteOne<K extends {}, V extends {}>(query: K, options?: V): Stream<void>;

  /**
   * Delete one model by Id
   * @param id
   * @param options
   * @returns stream with no result
   */
  abstract deleteById<K extends {}>(id: string, options?: K): Stream<void>;

  /**
   * Adds a list of models to the collection
   * @param records list of models
   * @returns stream with list of model ids
   */
  abstract insertAll(records: T[]): Stream<string[]>;

  /**
   * Adds model to the collection
   * @param record model
   * @returns stream with model id
   */
  abstract insertOne(record: T): Stream<string>;

  /**
   * Counts the number of models in this collection
   * @returns stream with the number of models in the collection
   */
  abstract count(): Stream<number>;

  /**
   * Searches for all models that matches the given text search criteria
   * @param pattern
   * @param options
   * @returns Stream<T[]> A stream of all the models that matched
   */
  abstract search<K extends {}>(pattern: string | RegExp, options?: K): Stream<T[]>;
}
