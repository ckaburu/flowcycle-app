import { realmRepo } from "./realmRepo";
import { Repository } from "./repo";

export function getRepository(): Repository {
  return realmRepo;
}
