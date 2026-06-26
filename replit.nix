{pkgs}: {
  deps = [
    pkgs.redis
    pkgs.postgresql
    pkgs.gcc
    pkgs.cmake
  ];
}
