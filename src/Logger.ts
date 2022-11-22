export type ILoggerCallback = (message: string) => void;
export const DefaultLogger: ILoggerCallback = (message) => {
  console.log(message);
};
