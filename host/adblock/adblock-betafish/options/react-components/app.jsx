import { GeneralOptionsTab } from "./general/GeneralOptionsTab";
const contentWrapperClasses = "flex flex-col justify-center mx-5 mb-6 flex-initial w-[711px]";

export function App({ optionsData }) {
  return (
    <div className={contentWrapperClasses} data-testid="options_app">
      <GeneralOptionsTab {...optionsData} />
    </div>
  );
}
