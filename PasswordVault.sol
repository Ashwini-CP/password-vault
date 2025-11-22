mapping(address => string[]) private userVaults;

function storeCID(string memory cid) public {
    userVaults[msg.sender].push(cid);
}

function getMyCIDs() public view returns (string[] memory) {
    return userVaults[msg.sender];
}
