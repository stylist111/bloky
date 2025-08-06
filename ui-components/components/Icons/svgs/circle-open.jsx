import PropTypes from "prop-types";

export const OpenCircle = ({ label = "", size = "24px" }) => {
  return (
    <svg
      data-testid="svg-icon-open-circle"
      className="stroke-inherit"
      width={size}
      viewBox="-2 -2 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="10" cy="10" r="10" fill="none" strokeWidth="2" />
      {label && <title>{label}</title>}
    </svg>
  );
};

OpenCircle.propTypes = {
  label: PropTypes.string,
  size: PropTypes.string,
};

export default OpenCircle;
