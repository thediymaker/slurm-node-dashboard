import HeaderMenu from "./header-menu";

const ModuleHeader = () => {
  return (
    <div className="mt-3 justify-between flex ">
      <div className="flex items-center h-full mr-4">
        <HeaderMenu />
      </div>
    </div>
  );
};

export default ModuleHeader;
