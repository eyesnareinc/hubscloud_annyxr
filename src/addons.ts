import { App } from "./app";
import { prefabs } from "./prefabs/prefabs";

import {
  InflatorConfigT,
  SystemConfigT,
  SystemOrderE,
  PrefabConfigT,
  NetworkSchemaConfigT,
  ChatCommandConfigT
} from "./types";
import configs from "./utils/configs";
import { commonInflators, gltfInflators, jsxInflators } from "./utils/jsx-entity";
import { networkableComponents, schemas } from "./utils/network-schemas";

function getNextIdx(slot: Array<SystemConfigT>, system: SystemConfigT) {
  return slot.findIndex(item => {
    item.order > system.order;
  });
}

function registerSystem(system: SystemConfigT) {
  let slot = APP.addon_systems.prePhysics;
  if (system.order < SystemOrderE.PrePhysics) {
    slot = APP.addon_systems.setup;
  } else if (system.order < SystemOrderE.PostPhysics) {
    slot = APP.addon_systems.prePhysics;
  } else if (system.order < SystemOrderE.MatricesUpdate) {
    slot = APP.addon_systems.postPhysics;
  } else if (system.order < SystemOrderE.BeforeRender) {
    slot = APP.addon_systems.beforeRender;
  } else if (system.order < SystemOrderE.AfterRender) {
    slot = APP.addon_systems.afterRender;
  } else if (system.order < SystemOrderE.PostProcessing) {
    slot = APP.addon_systems.postProcessing;
  } else {
    slot = APP.addon_systems.tearDown;
  }
  const nextIdx = getNextIdx(slot, system);
  slot.splice(nextIdx, 0, system);
}

function registerInflator(inflator: InflatorConfigT) {
  if (inflator.common) {
    commonInflators[inflator.common.id] = inflator.common.inflator;
  } else {
    if (inflator.jsx) {
      jsxInflators[inflator.jsx.id] = inflator.jsx.inflator;
    }
    if (inflator.gltf) {
      gltfInflators[inflator.gltf.id] = inflator.gltf.inflator;
    }
  }
}

function registerPrefab(prefab: PrefabConfigT) {
  if (prefabs.has(prefab.id)) {
    throw Error(`Error registering prefab ${name}: prefab already registered`);
  }
  prefabs.set(prefab.id, prefab.config);
}

function registerNetworkSchema(schemaConfig: NetworkSchemaConfigT) {
  if (schemas.has(schemaConfig.component)) {
    throw Error(
      `Error registering network schema ${schemaConfig.schema.componentName}: network schema already registered`
    );
  }
  schemas.set(schemaConfig.component, schemaConfig.schema);
  networkableComponents.push(schemaConfig.component);
}

function registerChatCommand(command: ChatCommandConfigT) {
  APP.messageDispatch.registerChatCommand(command.id, command.command);
}

export type AddonIdT = string;
export type AddonNameT = string;
export type AddonDescriptionT = string;
export type AddonOnReadyFn = (app: App, config?: JSON) => void;

export interface InternalAddonConfigT {
  name: AddonNameT;
  description?: AddonDescriptionT;
  onReady?: AddonOnReadyFn;
  system?: SystemConfigT | SystemConfigT[];
  inflator?: InflatorConfigT | InflatorConfigT[];
  prefab?: PrefabConfigT | PrefabConfigT[];
  networkSchema?: NetworkSchemaConfigT | NetworkSchemaConfigT[];
  chatCommand?: ChatCommandConfigT | ChatCommandConfigT[];
  enabled?: boolean;
  config?: JSON | undefined;
}
type AddonConfigT = Omit<InternalAddonConfigT, "enabled" | "config">;

const pendingAddons = new Map<AddonIdT, InternalAddonConfigT>();
export const addons = new Map<AddonIdT, AddonConfigT>();
export type AddonRegisterCallbackT = (app: App) => void;
export function registerAddon(id: AddonIdT, config: AddonConfigT) {
  console.log(`Add-on ${id} registered`);
  pendingAddons.set(id, config);
}

export function onAddonsInit(app: App) {
  app.scene?.addEventListener("hub_updated", () => {
    for (const [id, addon] of pendingAddons) {
      if (addons.has(id)) {
        throw Error(`Addon ${id} already registered`);
      } else {
        addons.set(id, addon);
      }

      if (app.hub?.user_data && `addon_${id}` in app.hub.user_data) {
        addon.enabled = app.hub.user_data[`addon_${id}`];
      } else {
        addon.enabled = false;
      }

      if (!addon.enabled) {
        continue;
      }

      if (addon.prefab) {
        if (Array.isArray(addon.prefab)) {
          addon.prefab.forEach(prefab => {
            registerPrefab(prefab);
          });
        } else {
          registerPrefab(addon.prefab);
        }
      }

      if (addon.networkSchema) {
        if (Array.isArray(addon.networkSchema)) {
          addon.networkSchema.forEach(networkSchema => {
            registerNetworkSchema(networkSchema);
          });
        } else {
          registerNetworkSchema(addon.networkSchema);
        }
      }

      if (addon.inflator) {
        if (Array.isArray(addon.inflator)) {
          addon.inflator.forEach(inflator => {
            registerInflator(inflator);
          });
        } else {
          registerInflator(addon.inflator);
        }
      }

      if (addon.system) {
        if (Array.isArray(addon.system)) {
          addon.system.forEach(system => {
            registerSystem(system);
          });
        } else {
          registerSystem(addon.system);
        }
      }

      if (addon.chatCommand) {
        if (Array.isArray(addon.chatCommand)) {
          addon.chatCommand.forEach(chatCommand => {
            registerChatCommand(chatCommand);
          });
        } else {
          registerChatCommand(addon.chatCommand);
        }
      }

      if (addon.onReady) {
        let config;
        const addonsConfig = configs.feature("addons_config");
        if (addonsConfig && id in addonsConfig) {
          config = addonsConfig[id];
        }
        addon.onReady(app, config);
      }
    }
    pendingAddons.clear();
  });
}
