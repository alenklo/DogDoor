// Manual type definitions to replace missing vite/client
// and provide type safety for process.env.API_KEY

declare const process: {
  env: {
    [key: string]: string | undefined;
    API_KEY: string;
  }
};

declare module '*.svg' {
  import * as React from 'react';
  export const ReactComponent: React.FunctionComponent<React.SVGProps<SVGSVGElement> & { title?: string }>;
  const src: string;
  export default src;
}

declare module '*.png' {
  const value: string;
  export default value;
}

declare module '*.jpg' {
  const value: string;
  export default value;
}

declare module '*.jpeg' {
  const value: string;
  export default value;
}

declare module '*.gif' {
  const value: string;
  export default value;
}

declare module '*.webp' {
  const value: string;
  export default value;
}

interface ImportMetaEnv {
  [key: string]: any;
  BASE_URL: string;
  MODE: string;
  DEV: boolean;
  PROD: boolean;
  SSR: boolean;
  VITE_API_KEY: string;
}

interface ImportMeta {
  url: string;
  readonly env: ImportMetaEnv;
  glob(pattern: string): Record<string, any>;
}
