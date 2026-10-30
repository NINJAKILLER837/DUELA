import type { Attributes } from "@/types";
import { ATTRIBUTE_GROUPS, ATTRIBUTE_LABEL } from "@/game/ratings";

export const ATTRIBUTE_GROUP_ORDER = ATTRIBUTE_GROUPS;
export function formatAttributeValue(key: keyof Attributes): string {
  return ATTRIBUTE_LABEL[key];
}
