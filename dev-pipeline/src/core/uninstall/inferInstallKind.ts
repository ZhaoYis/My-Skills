export function inferInstallKind(assetId: string): 'template' | 'static' {
  if (assetId.endsWith('.hbs')) {
    return 'template';
  }

  if (
    assetId === 'common-readme'
    || assetId.endsWith('-command')
    || assetId.endsWith('-docs')
    || assetId.endsWith('-command-guide')
  ) {
    return 'template';
  }

  const bundleEntry = assetId.includes(':') ? assetId.split(':').slice(1).join(':') : '';
  if (bundleEntry.endsWith('.hbs')) {
    return 'template';
  }

  return 'static';
}
