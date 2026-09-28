export class EmailStudioRevisionConflictError extends Error {
  constructor() {
    super("This studio project changed in another session. Reload before applying more edits.")
    this.name = "EmailStudioRevisionConflictError"
  }
}
