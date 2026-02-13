import { sqliteRepo } from "./sqliteRepo";
import { Repository } from "./repo";

export function getRepository(): Repository {
  return sqliteRepo;
}
