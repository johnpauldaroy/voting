<?php

namespace App\Enums;

enum ElectionStatus: string
{
    case DRAFT = 'draft';
    case OPEN = 'open';
    case CLOSED = 'closed';
}
