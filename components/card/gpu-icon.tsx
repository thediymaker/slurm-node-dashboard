import { CpuIcon } from "lucide-react";
import React from "react";

interface IconComponentProps {
  num_used: number;
  num_total: number;
}

const IconComponent: React.FC<IconComponentProps> = ({
  num_used,
  num_total,
}) => {
  const renderIcons = () => {
    const icons: JSX.Element[] = [];

    for (let i = 1; i <= num_total; i++) {
      const iconColor = i <= num_used ? "text-red-500" : "text-gray-400";

      icons.push(<CpuIcon size={"20"} key={i} className={`${iconColor}`} />);
    }

    return icons;
  };

  return <div className="flex mt-2">{renderIcons()}</div>;
};

export default IconComponent;
