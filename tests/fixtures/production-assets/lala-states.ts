export const LALA_PROJECT_ID = "11111111-1111-4111-8111-111111111111";

export const lalaProductionAssetFixture = {
  character: {
    id: "20000000-0000-4000-8000-000000000001",
    versionId: "21000000-0000-4000-8000-000000000001",
    type: "CHARACTER",
    name: "Lala",
  },
  components: {
    dailyOutfit: {
      id: "20000000-0000-4000-8000-000000000002",
      versionId: "21000000-0000-4000-8000-000000000002",
      type: "OUTFIT",
      name: "Lala daily outfit",
    },
    galaDress: {
      id: "20000000-0000-4000-8000-000000000003",
      versionId: "21000000-0000-4000-8000-000000000003",
      type: "OUTFIT",
      name: "Lala gala dress",
    },
    galaEarrings: {
      id: "20000000-0000-4000-8000-000000000004",
      versionId: "21000000-0000-4000-8000-000000000004",
      type: "ACCESSORY",
      name: "Lala gala earrings",
    },
    umbrella: {
      id: "20000000-0000-4000-8000-000000000005",
      versionId: "21000000-0000-4000-8000-000000000005",
      type: "PROP",
      name: "Umbrella",
    },
  },
  states: {
    daily: {
      id: "22000000-0000-4000-8000-000000000001",
      stateKey: "daily",
      name: "Daily",
      components: [
        {
          slotType: "OUTFIT",
          slotKey: "primary",
          componentAssetVersionId: "21000000-0000-4000-8000-000000000002",
          sortOrder: 0,
          required: true,
        },
      ],
    },
    gala: {
      id: "22000000-0000-4000-8000-000000000002",
      stateKey: "gala",
      name: "Gala",
      components: [
        {
          slotType: "OUTFIT",
          slotKey: "primary",
          componentAssetVersionId: "21000000-0000-4000-8000-000000000003",
          sortOrder: 0,
          required: true,
        },
        {
          slotType: "ACCESSORY",
          slotKey: "earrings",
          componentAssetVersionId: "21000000-0000-4000-8000-000000000004",
          sortOrder: 1,
          required: true,
        },
      ],
    },
  },
  shotLevelPropVersionIds: ["21000000-0000-4000-8000-000000000005"],
} as const;
