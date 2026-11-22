export function generateRegistry(opts?: { quiet?: boolean }): Array<{
  slug: string;
  public: boolean;
  thumbnail: boolean;
  ogImage: boolean;
  ogVideo: boolean;
}>;
export function discoverPrototypes(): ReturnType<typeof generateRegistry>;
