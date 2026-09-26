import { describe, expect, it } from 'vitest';
import { packagesToAlign } from './upgrade.ts';

const mosage = {
  dependencies: { react: '^19.3.0', 'react-dom': '^19.3.0', vite: '^8.2.1' },
  devDependencies: { '@types/react': '^19.3.0', '@types/react-dom': '^19.3.0' },
};

describe('packagesToAlign', () => {
  it('brings along whatever the project pins at another major', () => {
    const project = {
      dependencies: { mosage: '^0.8.0', react: '^18.3.1', 'react-dom': '^18.3.1' },
      devDependencies: {
        '@types/react': '^18.3.12',
        '@types/react-dom': '^18.3.1',
        vite: '^5.4.10',
      },
    };
    expect(packagesToAlign(project, mosage)).toEqual({
      deps: ['react@^19.3.0', 'react-dom@^19.3.0'],
      dev: ['@types/react@^19.3.0', '@types/react-dom@^19.3.0', 'vite@^8.2.1'],
    });
  });

  it('leaves a project that already matches, and adds nothing it does not list', () => {
    const project = {
      dependencies: { mosage: '^0.9.0', react: '^19.0.0', 'react-dom': '^19.1.0' },
      devDependencies: { '@types/react': '^19.0.0' },
    };
    expect(packagesToAlign(project, mosage)).toEqual({ deps: [], dev: [] });
  });
});
