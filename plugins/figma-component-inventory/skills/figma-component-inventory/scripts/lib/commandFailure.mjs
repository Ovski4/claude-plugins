// @ts-check
// The way a command of both skills stops with an exit code that tells the caller why.

/** Stops the command: the message goes to the error output, the code tells the caller why. */
export class CommandFailure extends Error {
  /**
   * @param {string} message
   * @param {number} exitCode
   */
  constructor(message, exitCode) {
    super(message)
    this.exitCode = exitCode
  }
}
