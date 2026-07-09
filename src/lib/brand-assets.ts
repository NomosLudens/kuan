export type BrandAsset = {
  url: string;
};

const brandAsset = (filename: string): BrandAsset => ({
  url: `/brand-assets/${filename}`,
});

export const kalineApple = brandAsset("kaline-apple.png");
export const kalineAvatar = brandAsset("kaline-avatar.png");
export const kalineWordmark = { url: "/kaline-wordmark.png" };

export const klioApple = brandAsset("klio-apple.png");
export const klioAvatar = brandAsset("klio.png");

export const khoraApple = brandAsset("khora-apple.png");
export const khoraAvatar = brandAsset("khora-avatar.png");

export const kharisApple = brandAsset("kharis-apple.png");
export const kharisAvatar = brandAsset("kharis-avatar.png");

export const kuanyinApple = brandAsset("kuanyin-apple.png");
export const kuanyinAvatar = brandAsset("kuanyin-avatar.png");

export const kaApple = brandAsset("ka-apple.png");
export const kaAvatar = brandAsset("ka.png");

export const driveAppleAsset = brandAsset("kaline-drive-apple.png");
export const driveAvatarAsset = brandAsset("kaline-drive-avatar.png");

export const kairosApple = brandAsset("kairos-apple.png");
export const kairosAvatar = brandAsset("kairos.png");
