import React from "react";

interface SystemHealthProps {
  status: string;
}

const SystemHealth = ({ status }: SystemHealthProps) => {
  if (status === "healthy") {
    return <div className="text-green-700 text-sm">Healthy</div>;
  } else {
    return <div className="text-red-700 text-sm">Unhealthy</div>;
  }
};

export default SystemHealth;
