import { Checkbox, Icon, Link, ToggleSwitch } from "@eyeo/ext-ui-components";
import { translate } from "./utils";

const OptionItem = ({
  name,
  onChangeFn,
  textKey,
  extraInfo,
  helpLink,
  additionalInfoLink,
  subOptions,
  isChecked,
  disabled = false,
  isSubOption = false,
  // Can be overridden in data list for parents that should show suboptions when parent is false
  showSubsParentState = true,
  selector = [Checkbox],
}) => {
  const subOptionLiClasses = isSubOption ? "pl-6" : "first-of-type:border-none";
  const itemClasses = [
    "text-lg border-t border-theme-accent-light transition duration-500 ease-in-out",
    subOptionLiClasses,
  ].join(" ");

  const alignmentClasses = isSubOption ? "items-baseline" : "items-center";
  const disabledOuterClasses = disabled ? "cursor-not-allowed opacity-50" : "";
  const disabledInnerClasses = disabled ? "pointer-events-none" : "";
  const outerDivClasses = [
    "flex justify-between py-2",
    alignmentClasses,
    disabledOuterClasses,
  ].join(" ");
  const innerDivClasses = ["flex", alignmentClasses, disabledInnerClasses].join(" ");

  const [Selector, selectorOptions = {}] = selector;
  const extraInfoPadding = Selector === ToggleSwitch ? "pl-11" : "pl-9";
  const extraInfoClasses = ["text-base italic", extraInfoPadding].join(" ");

  const optionChecked = isChecked(name);
  const showSubOptionsParentState = isChecked(name) === showSubsParentState;
  const onItemChange = (evt) => onChangeFn(name, evt);

  return (
    <li key={name} data-testid={`options_${name}`} className={itemClasses}>
      <div className={outerDivClasses}>
        <div className={innerDivClasses}>
          <Selector
            id={name}
            onChange={onItemChange}
            checked={optionChecked}
            {...selectorOptions}
          />
          <label className="ml-4" htmlFor={name}>
            {translate(textKey)}
          </label>
        </div>
        <div className="flex items-center text-base">
          {additionalInfoLink && (
            <Link href={additionalInfoLink.href}>{translate(additionalInfoLink.textKey)}</Link>
          )}
          {helpLink && (
            <span className="inline-block ml-2">
              <Link href={helpLink}>
                <Icon
                  name="live-help"
                  ariaLabel="learn_more_without_period"
                  className="fill-theme-text-secondary hover:fill-theme-link-color"
                  size="sm"
                />
              </Link>
            </span>
          )}
        </div>
      </div>
      <div className="mb-2 -mt-2.5">
        {extraInfo && <span className={extraInfoClasses}>{translate(extraInfo)}</span>}
      </div>
      <div>
        {subOptions && showSubOptionsParentState && (
          <ul>
            {subOptions.map((option) => (
              <OptionItem
                key={option.name}
                {...option}
                isSubOption
                selector={[ToggleSwitch, { kind: "inline" }]}
                onChangeFn={onChangeFn}
                isChecked={isChecked}
              />
            ))}
          </ul>
        )}
      </div>
    </li>
  );
};

export const OptionsList = ({ items, isChecked, onItemChange }) => {
  return (
    <>
      <ul>
        {items.map((item) => (
          <OptionItem key={item.name} {...item} isChecked={isChecked} onChangeFn={onItemChange} />
        ))}
      </ul>
    </>
  );
};
