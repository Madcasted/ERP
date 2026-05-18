declare module '*.css';
declare module '*.scss';
declare module '*.sass';
declare module '*.module.css';
declare module '*.module.scss';
declare module '*.module.sass';

interface CSSModuleClasses {
  readonly [key: string]: string;
}

declare const cssModule: CSSModuleClasses;
export default cssModule;
