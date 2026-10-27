/** A placement edit the admin asked for that cannot be done as asked (shown as the toast). */
export class PlacementActionError extends Error {
  readonly status: number;
  constructor(message: string, status = 422) {
    super(message);
    this.name = "PlacementActionError";
    this.status = status;
  }
}
