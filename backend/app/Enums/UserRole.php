<?php

namespace App\Enums;

enum UserRole: string
{
    case SUPER_ADMIN = 'super_admin';
    case ELECTION_ADMIN = 'election_admin';
    case VOTER = 'voter';
}
