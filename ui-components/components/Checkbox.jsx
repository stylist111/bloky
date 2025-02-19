import PropTypes from 'prop-types';
import { useState } from 'react';

/**
 * Checkbox component for controlled and uncontrolled use.
 *
 * @param {object} props - The props object
 * @param {boolean} [props.checked=false] - Controls whether the input is checked. You must also pass
 *    an `onChange` handler that updates the passed value.
 * @param {Function} props.onChange - Fires immediately when the input’s value is changed by the user.
 * @param {string} [props.id] - The id of the `input` element.
 * @param {boolean} [props.invalid] - Sets whether the element is in an invalid state.
 * @returns {JSX.Element}
 */
export const Checkbox = ({
  checked = false,
  onChange,
  id,
  invalid,
}) => {
  if (!onChange) {
    throw new Error('Checkbox is controlled but no `onChange` handler was provided.');
  }

  const [isChecked, setIsChecked] = useState(checked);
  const onChangeHandler = async (e) => {
    setIsChecked(e.target.checked);
    await onChange(e);
  }

  // Override the internal state when external state changes
  // This allows simple implementations not to have to control the state
  // while allowing more complex interactions when needed.
  const [prevExternalChecked, setPrevExternalChecked] = useState(checked);
  if (checked !== prevExternalChecked) {
    setPrevExternalChecked(checked);
    setIsChecked(checked);
  }

  const defaultStyles = [
    'inline-block', 'align-middle', 'cursor-pointer',

    // Size
    'w-5', 'h-5',

    // Transition
    'transition', 'duration-200', 'ease-in-out',

    // Colors
    'bg-theme-secondary',
    'checked:bg-theme-link-color', 'checked:hover:bg-theme-link-color',
    'checked:focus:bg-theme-link-color',
  ];
  const invalidStyles = invalid ? ['border-error'] : ['border-theme-secondary'];
  const className = [
    ...defaultStyles,
    ...invalidStyles,
  ].join(' ');

  return (
    <input
      id={id}
      type="checkbox"
      className={className}
      checked={isChecked}
      onChange={onChangeHandler}
    />
  );
};

Checkbox.propTypes = {
  checked: PropTypes.bool,
  onChange: PropTypes.func.isRequired,
  id: PropTypes.string,
  invalid: PropTypes.bool,
};
